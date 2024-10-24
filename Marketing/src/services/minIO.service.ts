import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

@Injectable()
export class MinIOService {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor() {
    this.s3Client = new S3Client({
      endpoint: `${process.env.MINIO_ENDPOINT}`,
    region: `${process.env.MINIO_REGION}`,
      credentials: {
        accessKeyId: `${process.env.MINIO_ACCESS_KEY}`,
        secretAccessKey: `${process.env.MINIO_SECRET_KEY}`,
      },
      forcePathStyle: true,
    });
    this.bucketName = `${process.env.MINIO_BUCKET}`;
  }

  async uploadFile(key: string, body: Buffer | Uint8Array | Blob | string) {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: body,
    });
    return await this.s3Client.send(command);
  }

  async deleteFile(key: string) {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });
    return await this.s3Client.send(command);
  }
}
