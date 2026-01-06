/**
 * Multer 파일 인터페이스
 * @nestjs/platform-express의 Multer 파일 타입 정의
 */
export interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}
