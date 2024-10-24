import { RequestExportExcelDto } from 'src/modules/analytics/dto/request-export-excel-dto';

export type ExportExcelJobDataDto = {
  params: RequestExportExcelDto;
  sqlQueryString: string;
  hashQueryParams: string;
  folderZipPath: string;
  fileType: string;
  createAt: number;
  metadata?: any;
};
