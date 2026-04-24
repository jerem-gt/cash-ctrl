import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { paymentMethodsApi } from '@/api/client';

export function usePaymentMethods() {
  return useQuery({ queryKey: ['payment-methods'], queryFn: paymentMethodsApi.list });
}

export function useCreatePaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: paymentMethodsApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payment-methods'] }),
  });
}

export function useUpdatePaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number; name: string; icon: string }) => paymentMethodsApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payment-methods'] }),
  });
}

export function useDeletePaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: paymentMethodsApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payment-methods'] }),
  });
}
