// zip.service.ts
import { Injectable } from '@nestjs/common';
import JSZip from 'jszip';
import * as fs from 'fs';
import { MinIOService } from './minIO.service';

@Injectable()
export class ZipService {
  constructor(
    private readonly minioService: MinIOService
  ) {}
  async zipFiles(filePaths: string[], outputPath: string): Promise<string> {
    try {
      const zip = new JSZip();

    // Add each file to the zip archive
    for (const filePath of filePaths) {
      let arr = filePath.split('/');
      const fileName = arr[arr.length - 1];
      const fileData = fs.readFileSync(filePath);
      zip.file(fileName, fileData);
    }

    // Generate the zip file asynchronously
    await zip.generateAsync({ type: 'nodebuffer' }).then((content) => {
      fs.writeFileSync(outputPath, content);
    });

    const fileData = fs.readFileSync(outputPath);
    const result = await this.minioService.uploadFile(outputPath, fileData);
    if(result?.$metadata?.httpStatusCode < 200 || result?.$metadata?.httpStatusCode >= 300) {
      throw new Error(`Upload To MinIO Errors`);
    }
    return outputPath;
    } catch (error) {
      console.log(`ZipService : ${error}`);
      throw new Error(`ZipService: ${error}`);
    }
  }
}
