import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AdminJwtAuthGuard } from '../auth/guards/admin-jwt-auth.guard';
import { AdminProductsService } from './admin-products.service';
import { AdminProductCreateDto } from './dto/admin-product-create.dto';
import { AdminProductListQueryDto } from './dto/admin-product-list-query.dto';
import { AdminProductUpdateDto } from './dto/admin-product-update.dto';
import type { MulterFile } from '../../media/types/multer-file.interface';

@ApiTags('Admin - Products')
@ApiBearerAuth('access-token')
@UseGuards(AdminJwtAuthGuard)
@Controller('admin/products')
export class AdminProductsController {
  constructor(private readonly adminProductsService: AdminProductsService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('thumbnail', {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024, // 최대 5MB
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '상품 등록' })
  createProduct(
    @Body() dto: AdminProductCreateDto,
    @UploadedFile() file?: MulterFile,
  ) {
    return this.adminProductsService.createProduct(dto, file);
  }

  @Get()
  @ApiOperation({ summary: '상품 리스트 조회' })
  listProducts(@Query() query: AdminProductListQueryDto) {
    return this.adminProductsService.listProducts(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '상품 상세 조회' })
  getProduct(@Param('id') productId: string) {
    return this.adminProductsService.getProductDetail(productId);
  }

  @Patch(':id')
  @UseInterceptors(
    FileInterceptor('thumbnail', {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024, // 최대 5MB
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '상품 정보 수정' })
  updateProduct(
    @Param('id') productId: string,
    @Body() dto: AdminProductUpdateDto,
    @UploadedFile() file?: MulterFile,
  ) {
    return this.adminProductsService.updateProduct(productId, dto, file);
  }

  @Delete(':id')
  @ApiOperation({ summary: '상품 삭제 (Soft Delete)' })
  deleteProduct(@Param('id') productId: string) {
    return this.adminProductsService.deleteProduct(productId);
  }
}
