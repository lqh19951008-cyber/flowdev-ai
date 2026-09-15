"""Real-Time In-Memory Event Bus for Live Multi-Tenant Dashboard Streaming."""

import asyncio
import json
import logging
from typing import Any, AsyncGenerator, Dict, Set

logger = logging.getLogger("flowdev.event_bus")


class EventBus:
    """Asynchronous Pub/Sub Event Bus for broadcasting events to connected Web clients."""

    _subscribers: Set[asyncio.Queue] = set()

    @classmethod
    async def subscribe(cls) -> AsyncGenerator[str, None]:
        """Subscribes an SSE client and yields real-time event packets."""
        queue: asyncio.Queue = asyncio.Queue()
        cls._subscribers.add(queue)
        logger.info(f"New SSE client connected to EventBus. Total active listeners: {len(cls._subscribers)}")

        # Send initial connected greeting
        initial_msg = f"event: connected\ndata: {json.dumps({'status': 'listening', 'activeClients': len(cls._subscribers)}, ensure_ascii=False)}\n\n"
        yield initial_msg

        try:
            while True:
                try:
                    # Wait for message with 15-second heartbeat timeout
                    event_packet = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield event_packet
                except asyncio.TimeoutError:
                    # Heartbeat comment to keep connection alive
                    yield ": ping heartbeat\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            cls._subscribers.discard(queue)
            logger.info(f"SSE client disconnected from EventBus. Remaining listeners: {len(cls._subscribers)}")

    @classmethod
    async def broadcast(cls, event: str, data: Dict[str, Any]) -> None:
        """Broadcasts an event to all connected Web clients."""
        if not cls._subscribers:
            return

        wire_msg = f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
        logger.info(f"Broadcasting event '{event}' to {len(cls._subscribers)} active listener(s)")

        for queue in list(cls._subscribers):
            try:
                queue.put_nowait(wire_msg)
            except Exception as e:
                logger.warning(f"Failed to deliver event to subscriber queue: {e}")
                cls._subscribers.discard(queue)
