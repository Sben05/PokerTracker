declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    EDIT_PASSCODE?: string;
    SESSION_SECRET?: string;
    BUCKET?: R2Bucket;
  }
}
