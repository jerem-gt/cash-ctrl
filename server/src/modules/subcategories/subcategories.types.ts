export interface Subcategory {
  id: number;
  category_id: number;
  name: string;
  created_at: string;
}

export interface SubcategoryWithCount extends Subcategory {
  tx_count: number;
}

export interface CreateSubcategoryInput {
  category_id: number;
  name: string;
}
