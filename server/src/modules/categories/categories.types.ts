import { SubcategoryWithCount } from '../subcategories/subcategories.types';

export interface Category {
  id: number;
  name: string;
  color: string;
  icon: string;
  created_at: string;
}

export interface CategoryWithCountAndSubCategories extends Category {
  tx_count: number;
  subcategories: SubcategoryWithCount[];
}

export interface CreateCategoryInput {
  name: string;
  color: string;
  icon: string;
}
