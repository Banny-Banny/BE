import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { MediaType } from '../common/enums';
import { Media, User } from '../entities';
import { PresignMediaDto } from './dto/presign-media.dto';
import { CompleteMediaDto } from './dto/complete-media.dto';
import { randomUUID } from 'crypto';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const VIDEO_TYPES = ['video/mp4'];
// MP3, M4A(AAC 컨테이너) 허용
const AUDIO_TYPES = ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac'];
const IMAGE_MAX = 5 * 1024 * 1024; // 5MB
const VIDEO_MAX = 200 * 1024 * 1024; // 200MB
const AUDIO_MAX = 20 * 1024 * 1024; // 20MB

@Injectable()
export class MediaService {
  private readonly bucket: string;
  private readonly prefix: string;
  private readonly presignTtl: number;
  private readonly signedUrlTtl: number;
  private readonly kmsKeyId: string | undefined;
  private readonly s3: S3Client;

  constructor(
    @InjectRepository(Media)
    private readonly mediaRepo: Repository<Media>,
    private readonly configService: ConfigService,
  ) {
    this.bucket = this.configService.get<string>('S3_BUCKET', '');
    this.prefix = this.configService.get<string>('S3_UPLOAD_PREFIX', 'media');
    this.presignTtl = this.configService.get<number>('S3_PRESIGN_TTL', 600);
    this.signedUrlTtl = this.configService.get<number>(
      'S3_SIGNED_URL_TTL',
      300,
    );
    this.kmsKeyId = this.configService.get<string>('S3_KMS_KEY_ID');
    if (!this.bucket) {
      throw new Error('S3_BUCKET is not configured');
    }
    this.s3 = new S3Client({
      region: this.configService.get<string>('AWS_REGION', 'ap-northeast-2'),
    });
  }

  private validateFile(dto: PresignMediaDto) {
    const isImage = dto.type === MediaType.IMAGE;
    const isVideo = dto.type === MediaType.VIDEO;
    const isAudio = dto.type === MediaType.AUDIO;

    if (!isImage && !isVideo && !isAudio) {
      throw new BadRequestException('UNSUPPORTED_MEDIA_TYPE');
    }

    if (isImage && !IMAGE_TYPES.includes(dto.content_type)) {
      throw new BadRequestException('INVALID_CONTENT_TYPE');
    }
    if (isVideo && !VIDEO_TYPES.includes(dto.content_type)) {
      throw new BadRequestException('INVALID_CONTENT_TYPE');
    }
    if (isAudio && !AUDIO_TYPES.includes(dto.content_type)) {
      throw new BadRequestException('INVALID_CONTENT_TYPE');
    }

    if (dto.size <= 0) {
      throw new BadRequestException('INVALID_SIZE');
    }
    if (isImage && dto.size > IMAGE_MAX) {
      throw new BadRequestException('IMAGE_SIZE_EXCEEDED');
    }
    if (isVideo && dto.size > VIDEO_MAX) {
      throw new BadRequestException('VIDEO_SIZE_EXCEEDED');
    }
    if (isAudio && dto.size > AUDIO_MAX) {
      throw new BadRequestException('AUDIO_SIZE_EXCEEDED');
    }
  }

  private resolveMediaType(contentType: string): MediaType {
    if (IMAGE_TYPES.includes(contentType)) {
      return MediaType.IMAGE;
    }
    if (VIDEO_TYPES.includes(contentType)) {
      return MediaType.VIDEO;
    }
    if (AUDIO_TYPES.includes(contentType)) {
      return MediaType.AUDIO;
    }
    throw new BadRequestException('INVALID_CONTENT_TYPE');
  }

  private buildObjectKey(userId: string, type: MediaType, filename: string) {
    const ext = filename.includes('.') ? filename.split('.').pop() : '';
    const key = `${this.prefix}/${userId}/${type}/${randomUUID()}${ext ? `.${ext}` : ''}`;
    return key;
  }

  async presign(user: User, dto: PresignMediaDto) {
    this.validateFile(dto);
    const key = this.buildObjectKey(user.id, dto.type, dto.filename);

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: dto.content_type,
      ...(this.kmsKeyId
        ? { ServerSideEncryption: 'aws:kms', SSEKMSKeyId: this.kmsKeyId }
        : {}),
    });

    const uploadUrl = await getSignedUrl(this.s3, command, {
      expiresIn: this.presignTtl,
    });

    return {
      upload_url: uploadUrl,
      object_key: key,
      content_type: dto.content_type,
      expires_in: this.presignTtl,
    };
  }

  async complete(user: User, dto: CompleteMediaDto) {
    const type = this.resolveMediaType(dto.content_type);
    const entity = this.mediaRepo.create({
      userId: user.id,
      objectKey: dto.object_key,
      type,
      contentType: dto.content_type,
      size: dto.size,
      durationMs: dto.duration_ms ?? null,
      width: dto.width ?? null,
      height: dto.height ?? null,
    });
    const saved = await this.mediaRepo.save(entity);

    return {
      media_id: saved.id,
      object_key: saved.objectKey,
      type: saved.type,
      size: saved.size,
      content_type: saved.contentType,
    };
  }

  async getSignedUrl(user: User, mediaId: string) {
    const media = await this.mediaRepo.findOne({
      where: { id: mediaId, userId: user.id },
    });
    if (!media) {
      throw new NotFoundException('MEDIA_NOT_FOUND');
    }

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: media.objectKey,
    });

    const url = await getSignedUrl(this.s3, command, {
      expiresIn: this.signedUrlTtl,
    });

    return {
      url,
      expires_in: this.signedUrlTtl,
    };
  }
}
