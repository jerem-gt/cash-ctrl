export interface Category {
  id: number;
  name: string;
  color: string;
  created_at: string;
}

export interface CategoryWithCount extends Category {
  tx_count: number;
}

export interface CreateCategoryInput {
  name: string;
  color: string;
}
