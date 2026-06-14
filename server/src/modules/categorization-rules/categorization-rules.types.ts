export interface CategorizationRule {
  id: number;
  user_id: number;
  pattern: string;
  subcategory_id: number;
  sort_order: number;
}

export interface CreateRuleInput {
  pattern: string;
  subcategory_id: number;
}

export interface UpdateRuleInput {
  pattern: string;
  subcategory_id: number;
}
