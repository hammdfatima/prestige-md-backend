import { RtcRole, RtcTokenBuilder } from "agora-token";
import { status as HttpStatus } from "http-status";
import env from "~/env";
import { HttpError } from "~/middlewares/error-handler";

const TOKEN_TTL_SECONDS = 60 * 60 * 2;

function getAgoraCredentials() {
  const appId = env.AGORA_APP_ID?.trim();
  const appCertificate =
    env.AGORA_APP_CERTIFICATE?.trim() || env.AGORA_APP_TOKEN?.trim();

  if (!appId || !appCertificate) {
    throw new HttpError(
      "Video calling is not configured. Set AGORA_APP_ID and AGORA_APP_CERTIFICATE.",
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  return { appId, appCertificate };
}

export function agoraChannelForVisit(visitId: string) {
  return `visit_${visitId.replace(/-/g, "")}`;
}

export function agoraUidFromUserId(userId: string) {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return hash === 0 ? 1 : hash;
}

export function buildVisitRtcToken(input: {
  visitId: string;
  userId: string;
}) {
  const { appId, appCertificate } = getAgoraCredentials();
  const channelName = agoraChannelForVisit(input.visitId);
  const uid = agoraUidFromUserId(input.userId);
  const token = RtcTokenBuilder.buildTokenWithUid(
    appId,
    appCertificate,
    channelName,
    uid,
    RtcRole.PUBLISHER,
    TOKEN_TTL_SECONDS,
    TOKEN_TTL_SECONDS,
  );

  return {
    appId,
    channelName,
    token,
    uid,
    sessionType: "Video" as const,
  };
}
