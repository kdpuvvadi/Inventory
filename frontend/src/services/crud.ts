import type { RecordModel, UnsubscribeFunc } from 'pocketbase'

import pb from '@/lib/pocketbase'
import type { PaginatedResult } from '@/types'

export interface ListOptions {
  page?: number
  perPage?: number
  filter?: string
  sort?: string
  expand?: string
}

export async function listRecords<T extends RecordModel>(
  collection: string,
  options: ListOptions = {},
): Promise<PaginatedResult<T>> {
  const result = await pb.collection(collection).getList<T>(
    options.page ?? 1,
    options.perPage ?? 50,
    {
      filter: options.filter,
      sort: options.sort,
      expand: options.expand,
    },
  )

  return {
    page: result.page,
    perPage: result.perPage,
    totalItems: result.totalItems,
    totalPages: result.totalPages,
    items: result.items,
  }
}

export async function getRecord<T extends RecordModel>(
  collection: string,
  id: string,
  expand?: string,
): Promise<T> {
  return pb.collection(collection).getOne<T>(id, { expand })
}

export async function createRecord<T extends RecordModel>(
  collection: string,
  data: Partial<T> | Record<string, unknown>,
): Promise<T> {
  return pb.collection(collection).create<T>(data)
}

export async function updateRecord<T extends RecordModel>(
  collection: string,
  id: string,
  data: Partial<T> | Record<string, unknown>,
): Promise<T> {
  return pb.collection(collection).update<T>(id, data)
}

export async function deleteRecord(collection: string, id: string): Promise<boolean> {
  return pb.collection(collection).delete(id)
}

export function subscribeToCollection(
  collection: string,
  callback: (e: { action: string; record: RecordModel }) => void,
): () => void {
  void pb.collection(collection).subscribe('*', callback)

  return () => {
    void pb.collection(collection).unsubscribe('*')
  }
}

export type { UnsubscribeFunc }
