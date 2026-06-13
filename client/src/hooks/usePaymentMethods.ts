import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { paymentMethodsApi } from '@/api/client';
import { queryKeys } from '@/lib/queryKeys';

export function usePaymentMethods() {
  return useQuery({ queryKey: queryKeys.paymentMethods(), queryFn: paymentMethodsApi.list });
}

export function useCreatePaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: paymentMethodsApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.paymentMethods() }),
  });
}

export function useUpdatePaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number; name: string; icon: string }) =>
      paymentMethodsApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.paymentMethods() }),
  });
}

export function useDeletePaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: paymentMethodsApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.paymentMethods() }),
  });
}
