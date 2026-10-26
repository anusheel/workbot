/**
 * A WebSocket that opens again whenever it closes, as it does when a server
 * restarts for a deploy or a load balancer ends a long connection, until
 * `stop`. While it is down, `send` drops what it is given.
 */
export function reconnecting(
  url: string,
  on: { message(data: string): void; open?(): void; close?(): void },
  delay = 2000,
) {
  let socket: WebSocket;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  const connect = () => {
    socket = new WebSocket(url);
    socket.onopen = () => on.open?.();
    socket.onmessage = ({ data }) => on.message(String(data));
    socket.onclose = () => {
      on.close?.();
      if (!stopped) retry = setTimeout(connect, delay);
    };
  };
  connect();
  return {
    send(data: string) {
      if (socket.readyState === WebSocket.OPEN) socket.send(data);
    },
    stop() {
      stopped = true;
      clearTimeout(retry);
      socket.close();
    },
  };
}
