declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: number;
        isAdmin: boolean;
      };
    }
  }
}

export {};
