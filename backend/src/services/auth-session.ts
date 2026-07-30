import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import {
  generateRefreshToken,
  hashRefreshToken,
  MAX_REFRESH_SESSIONS_PER_USER,
  refreshSessionExpiresAt
} from "../lib/refresh-token.js";

const sessionUserSelect = {
  id: true,
  name: true,
  jellyfinUserId: true,
  avatarTag: true,
  isAdmin: true,
  isEnabled: true
} satisfies Prisma.SiteUserSelect;

async function pruneUserSessions(
  transaction: Prisma.TransactionClient,
  userId: number,
  now: Date
): Promise<void> {
  await transaction.authSession.deleteMany({
    where: { userId, expiresAt: { lte: now } }
  });
  const excessSessions = await transaction.authSession.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: MAX_REFRESH_SESSIONS_PER_USER,
    select: { id: true }
  });
  if (excessSessions.length > 0) {
    await transaction.authSession.deleteMany({
      where: { id: { in: excessSessions.map(({ id }) => id) } }
    });
  }
}

export async function createRefreshSession(userId: number): Promise<string> {
  const token = generateRefreshToken();
  const now = new Date();
  await prisma.$transaction(async (transaction) => {
    await transaction.authSession.create({
      data: {
        userId,
        tokenHash: hashRefreshToken(token),
        expiresAt: refreshSessionExpiresAt(now.getTime())
      }
    });
    await pruneUserSessions(transaction, userId, now);
  });
  return token;
}

export async function upgradeLegacyRefreshSession(
  userId: number,
  legacyToken: string,
  legacyExpiresAt: Date
): Promise<string | null> {
  const token = generateRefreshToken();
  const now = new Date();
  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.usedLegacyRefreshToken.deleteMany({
        where: { expiresAt: { lte: now } }
      });
      await transaction.usedLegacyRefreshToken.create({
        data: {
          tokenHash: hashRefreshToken(legacyToken),
          expiresAt: legacyExpiresAt
        }
      });
      await transaction.authSession.create({
        data: {
          userId,
          tokenHash: hashRefreshToken(token),
          expiresAt: refreshSessionExpiresAt(now.getTime())
        }
      });
      await pruneUserSessions(transaction, userId, now);
    });
    return token;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return null;
    }
    throw error;
  }
}

export async function rotateRefreshSession(token: string) {
  const nextToken = generateRefreshToken();
  const now = new Date();
  return prisma.$transaction(async (transaction) => {
    const current = await transaction.authSession.findUnique({
      where: { tokenHash: hashRefreshToken(token) },
      include: { user: { select: sessionUserSelect } }
    });
    if (!current) return null;

    if (current.expiresAt <= now || !current.user.isEnabled) {
      await transaction.authSession.deleteMany({ where: { userId: current.userId } });
      return null;
    }

    const claimed = await transaction.authSession.deleteMany({
      where: { id: current.id, tokenHash: current.tokenHash }
    });
    if (claimed.count !== 1) return null;

    await transaction.authSession.create({
      data: {
        userId: current.userId,
        tokenHash: hashRefreshToken(nextToken),
        expiresAt: refreshSessionExpiresAt(now.getTime())
      }
    });
    await pruneUserSessions(transaction, current.userId, now);
    return { token: nextToken, user: current.user };
  });
}

export async function revokeRefreshSession(token: string): Promise<void> {
  await prisma.authSession.deleteMany({
    where: { tokenHash: hashRefreshToken(token) }
  });
}
