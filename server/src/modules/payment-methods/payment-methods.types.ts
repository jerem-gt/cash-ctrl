export interface PaymentMethod {
  id: number;
  name: string;
  icon: string;
  created_at: string;
}

export interface PaymentMethodWithCount extends PaymentMethod {
  tx_count: number;
}

export interface CreatePaymentMethodInput {
  name: string;
  icon: string;
}
