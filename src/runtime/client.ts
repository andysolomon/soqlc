export interface SoqlQueryResult<T> {
  totalSize: number;
  done: boolean;
  nextRecordsUrl?: string;
  records: T[];
}

export interface SoqlQueryOptions {
  tooling?: boolean;
}

export interface SoqlClient {
  query<T>(soql: string, options?: SoqlQueryOptions): Promise<SoqlQueryResult<T>>;
  queryMore?<T>(nextRecordsUrl: string): Promise<SoqlQueryResult<T>>;
}
