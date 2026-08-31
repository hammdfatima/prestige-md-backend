import { status as HttpStatus } from "http-status";
import type { Prisma } from "~/generated/prisma/client";
import prisma from "~/lib/db";
import { emailLookupHash } from "~/lib/field-encryption";
import { resolveAuditTargetLabel } from "~/lib/phi-access-audit";
import { HttpError } from "~/middlewares/error-handler";
import { hasTeamPermission } from "~/lib/permissions";
import type { ListSecurityAuditQuery } from "~/schemas/security-audit-schemas";
import type { TokenPayload } from "~/types";

function assertCanViewAuditTrail(auth: TokenPayload) {
  if (!hasTeamPermission(auth, "view_audit_trail")) {
    throw new HttpError(
      "You do not have access to this resource",
      HttpStatus.FORBIDDEN,
    );
  }
}

function buildAuditWhere(query: ListSecurityAuditQuery): Prisma.SecurityAuditEventWhereInput {
  const where: Prisma.SecurityAuditEventWhereInput = {};

  if (query.eventType) {
    where.eventType = query.eventType;
  }

  if (query.actorEmail) {
    where.actorEmailLookupHash = emailLookupHash(query.actorEmail);
  }

  if (query.actorId) {
    where.actorId = query.actorId;
  }

  if (query.targetResource) {
    where.targetResource = {
      contains: query.targetResource,
      mode: "insensitive",
    };
  }

  if (query.dateFrom || query.dateTo) {
    where.createdAt = {};
    if (query.dateFrom) {
      where.createdAt.gte = new Date(`${query.dateFrom}T00:00:00.000Z`);
    }
    if (query.dateTo) {
      where.createdAt.lte = new Date(`${query.dateTo}T23:59:59.999Z`);
    }
  }

  return where;
}

export async function listSecurityAuditEvents(
  auth: TokenPayload,
  query: ListSecurityAuditQuery,
) {
  assertCanViewAuditTrail(auth);

  const where = buildAuditWhere(query);

  const [items, total] = await Promise.all([
    prisma.securityAuditEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: {
        id: true,
        eventType: true,
        actorId: true,
        actorRole: true,
        actorEmail: true,
        targetResource: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
      },
    }),
    prisma.securityAuditEvent.count({ where }),
  ]);

  return {
    items: items.map((item) => ({
      ...item,
      targetLabel: resolveAuditTargetLabel(item.targetResource),
      createdAt: item.createdAt.toISOString(),
    })),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

/** @internal — exported for tests; prefer route middleware + service. */
export { assertCanViewAuditTrail };
