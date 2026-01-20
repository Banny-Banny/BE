import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminJwtAuthGuard } from '../auth/guards/admin-jwt-auth.guard';
import { AdminProductsService } from './admin-products.service';
import { AdminProductCreateDto } from './dto/admin-product-create.dto';
import { AdminProductListQueryDto } from './dto/admin-product-list-query.dto';
import { AdminProductUpdateDto } from './dto/admin-product-update.dto';

@ApiTags('Admin - Products')
@ApiBearerAuth('access-token')
@UseGuards(AdminJwtAuthGuard)
@Controller('admin/products')
export class AdminProductsController {
  constructor(private readonly adminProductsService: AdminProductsService) {}

  @Post()
  @ApiOperation({ summary: '상품 등록' })
  createProduct(@Body() dto: AdminProductCreateDto) {
    return this.adminProductsService.createProduct(dto);
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
  @ApiOperation({ summary: '상품 정보 수정' })
  updateProduct(
    @Param('id') productId: string,
    @Body() dto: AdminProductUpdateDto,
  ) {
    return this.adminProductsService.updateProduct(productId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '상품 삭제 (Soft Delete)' })
  deleteProduct(@Param('id') productId: string) {
    return this.adminProductsService.deleteProduct(productId);
  }
}
