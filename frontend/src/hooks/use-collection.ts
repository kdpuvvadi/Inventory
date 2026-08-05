import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { RecordModel } from 'pocketbase'

import {
  getRecord,
  listRecords,
  subscribeToCollection,
  type ListOptions,
} from '@/services/crud'
import type { PaginatedResult } from '@/types'
import type { CollectionName, CollectionRecordMap } from '@/types'

export function collectionQueryKey(
  collection: string,
  options?: ListOptions,
): unknown[] {
  return ['collection', collection, options ?? {}]
}

export function recordQueryKey(
  collection: string,
  id: string,
  expand?: string,
): unknown[] {
  return ['record', collection, id, expand ?? '']
}

export function useCollectionQuery<T extends RecordModel = RecordModel>(
  collection: string,
  options?: ListOptions,
) {
  return useQuery<PaginatedResult<T>>({
    queryKey: collectionQueryKey(collection, options),
    queryFn: () => listRecords<T>(collection, options),
  })
}

export function useTypedCollectionQuery<K extends CollectionName>(
  collection: K,
  options?: ListOptions,
) {
  return useCollectionQuery<CollectionRecordMap[K] & RecordModel>(collection, options)
}

export function useRealtimeCollection(
  collection: string,
  queryKey?: unknown[],
) {
  const queryClient = useQueryClient()
  const resolvedKey = queryKey ?? ['collection', collection]

  useEffect(() => {
    const unsubscribe = subscribeToCollection(collection, () => {
      queryClient.invalidateQueries({ queryKey: resolvedKey })
      queryClient.invalidateQueries({ queryKey: ['collection', collection] })
      queryClient.invalidateQueries({ queryKey: ['record', collection] })
    })

    return unsubscribe
  }, [collection, queryClient, resolvedKey])
}

export function useRecord<T extends RecordModel = RecordModel>(
  collection: string,
  id: string | undefined,
  expand?: string,
  options?: { staleTime?: number; refetchOnMount?: boolean | 'always' },
) {
  return useQuery<T>({
    queryKey: recordQueryKey(collection, id ?? '', expand),
    queryFn: () => getRecord<T>(collection, id!, expand),
    enabled: Boolean(id),
    staleTime: options?.staleTime,
    refetchOnMount: options?.refetchOnMount,
  })
}
