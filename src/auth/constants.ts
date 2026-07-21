export const LOOPBACK_CALLBACK_HOST = "127.0.0.1"
export const LOOPBACK_CALLBACK_PATH = "/callback"

/**
 * Spotify permits a dynamically assigned port for loopback IP literals when
 * the registered redirect URI omits the port.
 */
export const REDIRECT_REGISTRATION_URI =
  `http://${LOOPBACK_CALLBACK_HOST}${LOOPBACK_CALLBACK_PATH}`
