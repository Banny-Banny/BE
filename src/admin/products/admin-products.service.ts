import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product, ProductType } from '../../entities';
import { AdminProductCreateDto } from './dto/admin-product-create.dto';
import { AdminProductListQueryDto } from './dto/admin-product-list-query.dto';
import { AdminProductUpdateDto } from './dto/admin-product-update.dto';

@Injectable()
export class AdminProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async createProduct(dto: AdminProductCreateDto) {
    const productType = dto.productType ?? ProductType.TIME_CAPSULE;
    const maxMediaCount =
      dto.maxMediaCount !== undefined ? dto.maxMediaCount : null;

    this.validateEasterEggConstraints(productType, maxMediaCount);

    const product = this.productRepository.create({
      name: dto.name,
      price: dto.price,
      description: dto.description ?? null,
      thumbnailUrl: dto.thumbnailUrl ?? null,
      categoryId: dto.categoryId ?? null,
      isActive: dto.isActive ?? true,
      productType,
      mediaTypes: dto.mediaTypes ?? null,
      maxMediaCount,
    });

    const saved = await this.productRepository.save(product);
    return {
      success: true,
      data: this.buildProductResponse(saved),
    };
  }

  async listProducts(query: AdminProductListQueryDto) {
    const qb = this.productRepository
      .createQueryBuilder('product')
      .withDeleted();

    if (query.search) {
      qb.andWhere('product.name ILIKE :search', {
        search: `%${query.search}%`,
      });
    }

    if (query.categoryId) {
      qb.andWhere('product.category_id = :categoryId', {
        categoryId: query.categoryId,
      });
    }

    if (query.status === 'ACTIVE') {
      qb.andWhere('product.is_active = true');
      qb.andWhere('product.deleted_at IS NULL');
    } else if (query.status === 'INACTIVE') {
      qb.andWhere('product.is_active = false');
      qb.andWhere('product.deleted_at IS NULL');
    } else if (query.status === 'DELETED') {
      qb.andWhere('product.deleted_at IS NOT NULL');
    }

    const [items, total] = await qb
      .orderBy('product.created_at', 'DESC')
      .skip(query.offset)
      .take(query.limit)
      .getManyAndCount();

    return {
      success: true,
      data: {
        items: items.map((product) => this.buildProductResponse(product)),
        total,
        limit: query.limit,
        offset: query.offset,
      },
    };
  }

  async getProductDetail(productId: string) {
    const product = await this.productRepository.findOne({
      where: { id: productId },
      withDeleted: true,
    });

    if (!product) {
      throw new NotFoundException('상품을 찾을 수 없습니다.');
    }

    return {
      success: true,
      data: this.buildProductResponse(product),
    };
  }

  async updateProduct(productId: string, dto: AdminProductUpdateDto) {
    const product = await this.productRepository.findOne({
      where: { id: productId },
      withDeleted: true,
    });

    if (!product) {
      throw new NotFoundException('상품을 찾을 수 없습니다.');
    }

    const updates: Partial<Product> = {};
    if (dto.name !== undefined) updates.name = dto.name;
    if (dto.price !== undefined) updates.price = dto.price;
    if (dto.description !== undefined) updates.description = dto.description;
    if (dto.thumbnailUrl !== undefined) updates.thumbnailUrl = dto.thumbnailUrl;
    if (dto.categoryId !== undefined) updates.categoryId = dto.categoryId;
    if (dto.isActive !== undefined) updates.isActive = dto.isActive;
    if (dto.productType !== undefined) updates.productType = dto.productType;
    if (dto.mediaTypes !== undefined) updates.mediaTypes = dto.mediaTypes;
    if (dto.maxMediaCount !== undefined)
      updates.maxMediaCount = dto.maxMediaCount;

    if (!Object.keys(updates).length) {
      throw new BadRequestException('수정할 데이터가 없습니다.');
    }

    const nextProductType = updates.productType ?? product.productType;
    const nextMaxMediaCount =
      updates.maxMediaCount !== undefined
        ? updates.maxMediaCount
        : product.maxMediaCount;

    this.validateEasterEggConstraints(nextProductType, nextMaxMediaCount);

    Object.assign(product, updates);
    const saved = await this.productRepository.save(product);

    return {
      success: true,
      data: this.buildProductResponse(saved),
    };
  }

  async deleteProduct(productId: string) {
    const product = await this.productRepository.findOne({
      where: { id: productId },
      withDeleted: true,
    });

    if (!product) {
      throw new NotFoundException('상품을 찾을 수 없습니다.');
    }

    if (product.deletedAt) {
      return { success: true };
    }

    product.isActive = false;
    await this.productRepository.save(product);
    await this.productRepository.softRemove(product);

    return { success: true };
  }

  private validateEasterEggConstraints(
    productType: ProductType,
    maxMediaCount: number | null | undefined,
  ) {
    if (productType !== ProductType.EASTER_EGG) {
      return;
    }

    if (maxMediaCount === null || maxMediaCount === undefined) {
      throw new BadRequestException(
        '이스터에그 상품은 maxMediaCount가 필요합니다.',
      );
    }

    if (maxMediaCount < 0 || maxMediaCount > 3) {
      throw new BadRequestException(
        '이스터에그 상품의 maxMediaCount는 0~3 사이여야 합니다.',
      );
    }
  }

  private buildProductResponse(product: Product) {
    return {
      id: product.id,
      name: product.name,
      price: product.price,
      description: product.description ?? null,
      thumbnailUrl: product.thumbnailUrl ?? null,
      categoryId: product.categoryId ?? null,
      productType: product.productType,
      mediaTypes: product.mediaTypes ?? null,
      maxMediaCount: product.maxMediaCount ?? null,
      isActive: product.isActive,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt ?? null,
      deletedAt: product.deletedAt ?? null,
    };
  }
}
