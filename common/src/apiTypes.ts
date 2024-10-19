export class ApiError {
  code: number;
  message: string;

  constructor(message, code = 500) {
    this.message = message;
    this.code = code;
  }
}
