import "server-only";
import { prisma } from "../db";
export function findKey(userId: string, purpose: string, version: number) {
  return prisma.userContentKey.findUnique({
    where: { userId_purpose_version: { userId, purpose, version } },
  });
}
export function findKeyById(id: string, userId: string, purpose: string) {
  return prisma.userContentKey.findFirst({ where: { id, userId, purpose } });
}
export function insertKey(data: {
  id: string;
  userId: string;
  purpose: string;
  version: number;
  environment: string;
  provider: string;
  wrappingKeyId: string;
  wrapped: string;
}) {
  return prisma.userContentKey.create({ data });
}
