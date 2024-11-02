export type Client = {
  id: number;
};

export type SatisfactoryEvent<T> = {
  type: string;
  data: T;
};
