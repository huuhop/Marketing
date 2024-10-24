import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import * as crypto from 'crypto-js';
import { checkPriceMetrics, statusFileDownload } from 'src/common/commom';
import {
  chunkArray,
  cleanupFolders,
  generateUniqueString,
  getObjectBySku,
  getTimestamp,
  sortKeysOfObject,
} from 'src/utilities/helper';
import { ElasticService } from 'src/modules/elastic/elastic.service';
import { QueueService } from 'src/modules/queue/queue.service';
import { RequestExportExcelDto } from 'src/modules/analytics/dto/request-export-excel-dto';
import { ExportExcelJobDataDto } from 'src/modules/analytics/dto/export-excel-job-data-dto';
import fs from 'fs';
import { ZipService } from 'src/services/zip.service';
import { CheckProgressExportExcelDto } from 'src/modules/analytics/dto/check-progress-export-excel-dto';

type KeyAndHeadingMappingType = { key: string; name: string };

type SplitAndCreateFileZipExcelType = {
  data: ExportExcelJobDataDto;
  getExcelDataFunc: ({ }: {
    metadata: RequestExportExcelDto;
    page: number;
  }) => Promise<{ data: { key: string; value: string }[][] }>;
  keyAndHeadingMapping: KeyAndHeadingMappingType[];
};

@Injectable()
export class ExcelService {
  protected bucketIO: string = process.env.MINIO_BUCKET;
  protected endPoindIO: string = process.env.MINIO_ENDPOINT;

  constructor(
    private elasticService: ElasticService,
    private queueService: QueueService,
    private zipService: ZipService,
  ) { }

  async createExcelFile(data: DataExcel, applyFormatting?: (worksheet: any) => void) {
    try {
      const { nameFile, heading, rawData } = data;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Sheet1');

      // Create columns from headers
      worksheet.columns = heading.map(({ name, key }) => ({
        header: name,
        key,
        width: 25,
      }));

      // Add rows to worksheet
      rawData.forEach((rowData: any) => {
        const rowObject = rowData.reduce((acc: any, { key, value }) => {
          acc[key] = value;
          return acc;
        }, {});
        worksheet.addRow(rowObject);
      });

      // Apply conditional formatting if needed
      if (applyFormatting) {
        applyFormatting(worksheet);
      }

      // Save the workbook
      await workbook.xlsx.writeFile(nameFile);
      return nameFile;
    } catch (err) {
      console.error(`createExcelFile: ${err}`);
      throw new Error(`ZipService: ${err}`);
    }
  }

  exportToExcel(data: DataExcel) {
    return this.createExcelFile(data);
  }

  exportToExcelCheckPrice(data: DataExcel): Promise<string> {
    const applyFormatting = (worksheet: ExcelJS.Worksheet) => {
      const columnsToStyle = checkPriceMetrics;

      const formatCell = (
        cell: ExcelJS.Cell,
        value: number | string,
        link: string | undefined,
        isLower: boolean
      ) => {
        if (link) {
          cell.value = {
            text: value.toString(),
            hyperlink: link,
          };
          cell.font = {
            color: { argb: '007bfd' }, // Blue text color
            underline: true, // Underline the text
          };
        }
        if (isLower) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF0000' }, // Red background if price is lower than Hasaki
          };
        }
      };

      worksheet.eachRow((row: ExcelJS.Row, rowIndex: number) => {
        if (rowIndex === 1) return; // Skip header row
        const rawRow = data.rawData[rowIndex - 2]; // Adjust for header
        const objHsk = getObjectBySku(columnsToStyle[0], rawRow, 'key');
        const objTiktok = getObjectBySku(columnsToStyle[1], rawRow, 'key');
        const objShopee = getObjectBySku(columnsToStyle[2], rawRow, 'key');
        const objLazada = getObjectBySku(columnsToStyle[3], rawRow, 'key');

        const hasakiPrice = objHsk.value;
        const tiktokPrice = objTiktok.value;
        const shopeePrice = objShopee.value;
        const lazadaPrice = objLazada.value;

        // Get hyperlinks
        const links = {
          hasaki: objHsk.hyperLink,
          tiktok: objTiktok.hyperLink,
          shopee: objShopee.hyperLink,
          lazada: objLazada.hyperLink,
        };

        // Get cells for each platform
        const cells = {
          hasaki: row.getCell(worksheet.getColumn(columnsToStyle[0]).number),
          tiktok: row.getCell(worksheet.getColumn(columnsToStyle[1]).number),
          shopee: row.getCell(worksheet.getColumn(columnsToStyle[2]).number),
          lazada: row.getCell(worksheet.getColumn(columnsToStyle[3]).number),
        };

        // Apply formatting for each platform
        formatCell(cells.hasaki, hasakiPrice, links.hasaki, false);
        formatCell(cells.tiktok, tiktokPrice, links.tiktok, tiktokPrice < hasakiPrice);
        formatCell(cells.shopee, shopeePrice, links.shopee, shopeePrice < hasakiPrice);
        formatCell(cells.lazada, lazadaPrice, links.lazada, lazadaPrice < hasakiPrice);
      });
    };

    return this.createExcelFile(data, applyFormatting);
  }
}
