export class ApiError {
  code: number;
  message: string;

  constructor(message: string, code = 500) {
    this.message = message;
    this.code = code;
  }
}
