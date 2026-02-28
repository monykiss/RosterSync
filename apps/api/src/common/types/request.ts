export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    // Augment Express.User (used by Passport) with our JWT fields
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User extends JwtPayload {}

    interface Request {
      studioId?: string;
      correlationId?: string;
    }
  }
}
