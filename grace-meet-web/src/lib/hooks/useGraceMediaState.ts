"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Room,
  Track,
  RoomEvent,
  ParticipantEvent,
  LocalTrackPublication,
} from "livekit-client";

export interface GraceMediaState {
  isCameraEnabled: boolean;
  isMicrophoneEnabled: boolean;
  isCameraPending: boolean;
  isMicPending: boolean;
  cameraError: Error | null;
  micError: Error | null;
  cameraPublication: LocalTrackPublication | undefined;
  microphonePublication: LocalTrackPublication | undefined;
  facingMode: "user" | "environment";
  hasMultipleCameras: boolean;

  // Actions
  toggleCamera: () => Promise<boolean>;
  toggleMicrophone: () => Promise<boolean>;
  flipCamera: () => Promise<void>;
  syncMediaState: () => void;
  clearErrors: () => void;
}

export function useGraceMediaState(
  room: Room | undefined,
  initialFacingMode: "user" | "environment" = "user",
  initialCamEnabled: boolean = true,
  initialMicEnabled: boolean = true
): GraceMediaState {
  const [isCameraEnabled, setIsCameraEnabled] = useState(initialCamEnabled);
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(initialMicEnabled);
  const [isCameraPending, setIsCameraPending] = useState(false);
  const [isMicPending, setIsMicPending] = useState(false);
  const [cameraError, setCameraError] = useState<Error | null>(null);
  const [micError, setMicError] = useState<Error | null>(null);
  const [facingMode, setFacingMode] =
    useState<"user" | "environment">(initialFacingMode);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  // Persistent desired intent to restore state across reconnection
  const desiredCameraStateRef = useRef(initialCamEnabled);
  const desiredMicStateRef = useRef(initialMicEnabled);

  const isCameraPendingRef = useRef(false);
  const isMicPendingRef = useRef(false);
  const isFlippingRef = useRef(false);

  // Check available cameras
  useEffect(() => {
    async function checkCameras() {
      try {
        const devices = await Room.getLocalDevices("videoinput");
        if (devices.length > 1) {
          setHasMultipleCameras(true);
        }
      } catch {
        if (typeof window !== "undefined" && "ontouchstart" in window) {
          setHasMultipleCameras(true);
        }
      }
    }
    checkCameras();
  }, []);

  // Synchronous extraction of actual LiveKit publication and track states
  const syncMediaState = useCallback(() => {
    if (!room || !room.localParticipant) {
      return;
    }

    const localP = room.localParticipant;
    const camPub = localP.getTrackPublication(Track.Source.Camera);
    const micPub = localP.getTrackPublication(Track.Source.Microphone);

    // Camera is truly active if publication exists, is not muted, and track is live
    const camActive =
      !!camPub &&
      !camPub.isMuted &&
      (!camPub.track || camPub.track.mediaStreamTrack.readyState !== "ended");

    // Microphone is truly active if publication exists, is not muted, and track is live
    const micActive =
      !!micPub &&
      !micPub.isMuted &&
      (!micPub.track || micPub.track.mediaStreamTrack.readyState !== "ended");

    // Reconcile with LiveKit's native participant booleans
    const finalCam = camActive || localP.isCameraEnabled;
    const finalMic = micActive || localP.isMicrophoneEnabled;

    setIsCameraEnabled(finalCam);
    setIsMicrophoneEnabled(finalMic);

    console.log(
      `[GraceMeet][Media] Synchronized -> Camera: ${finalCam ? "ON" : "OFF"} (pub=${!!camPub}, muted=${camPub?.isMuted ?? "n/a"}), Mic: ${finalMic ? "ON" : "OFF"} (pub=${!!micPub}, muted=${micPub?.isMuted ?? "n/a"})`
    );
  }, [room]);

  // Subscribe to all relevant LiveKit events for automatic reactive synchronization
  useEffect(() => {
    if (!room) return;

    queueMicrotask(syncMediaState);

    const localP = room.localParticipant;

    const handleMediaChange = () => {
      syncMediaState();
    };

    const handleDeviceError = (err: Error) => {
      console.warn("[GraceMeet][Media] Device error:", err);
      const msg = err.message.toLowerCase();
      if (msg.includes("video") || msg.includes("camera")) {
        setCameraError(err);
      } else {
        setMicError(err);
      }
      syncMediaState();
    };

    // Reconnection media restoration handler
    const handleReconnected = async () => {
      console.log(
        "[GraceMeet][Reconnect] Reconnected! Verifying & restoring media tracks..."
      );
      syncMediaState();

      // Restore camera if user intended camera ON
      if (desiredCameraStateRef.current) {
        const camPub = localP.getTrackPublication(Track.Source.Camera);
        if (
          !camPub ||
          camPub.isMuted ||
          camPub.track?.mediaStreamTrack.readyState === "ended"
        ) {
          try {
            console.log("[GraceMeet][Reconnect] Restoring local camera publication...");
            await localP.setCameraEnabled(true, { facingMode });
          } catch (err) {
            console.warn("[GraceMeet][Reconnect] Camera restore failed:", err);
            desiredCameraStateRef.current = false;
          }
        }
      }

      // Restore mic if user intended mic ON
      if (desiredMicStateRef.current) {
        const micPub = localP.getTrackPublication(Track.Source.Microphone);
        if (
          !micPub ||
          micPub.isMuted ||
          micPub.track?.mediaStreamTrack.readyState === "ended"
        ) {
          try {
            console.log("[GraceMeet][Reconnect] Restoring local microphone publication...");
            await localP.setMicrophoneEnabled(true);
          } catch (err) {
            console.warn("[GraceMeet][Reconnect] Mic restore failed:", err);
            desiredMicStateRef.current = false;
          }
        }
      }

      syncMediaState();
    };

    // Participant events
    localP.on(ParticipantEvent.TrackMuted, handleMediaChange);
    localP.on(ParticipantEvent.TrackUnmuted, handleMediaChange);
    localP.on(ParticipantEvent.LocalTrackPublished, handleMediaChange);
    localP.on(ParticipantEvent.LocalTrackUnpublished, handleMediaChange);
    localP.on(ParticipantEvent.ParticipantPermissionsChanged, handleMediaChange);

    // Room events
    room.on(RoomEvent.LocalTrackPublished, handleMediaChange);
    room.on(RoomEvent.LocalTrackUnpublished, handleMediaChange);
    room.on(RoomEvent.TrackMuted, handleMediaChange);
    room.on(RoomEvent.TrackUnmuted, handleMediaChange);
    room.on(RoomEvent.SignalConnected, handleMediaChange);
    room.on(RoomEvent.Connected, handleMediaChange);
    room.on(RoomEvent.Reconnected, handleReconnected);
    room.on(RoomEvent.MediaDevicesError, handleDeviceError);

    return () => {
      localP.off(ParticipantEvent.TrackMuted, handleMediaChange);
      localP.off(ParticipantEvent.TrackUnmuted, handleMediaChange);
      localP.off(ParticipantEvent.LocalTrackPublished, handleMediaChange);
      localP.off(ParticipantEvent.LocalTrackUnpublished, handleMediaChange);
      localP.off(ParticipantEvent.ParticipantPermissionsChanged, handleMediaChange);

      room.off(RoomEvent.LocalTrackPublished, handleMediaChange);
      room.off(RoomEvent.LocalTrackUnpublished, handleMediaChange);
      room.off(RoomEvent.TrackMuted, handleMediaChange);
      room.off(RoomEvent.TrackUnmuted, handleMediaChange);
      room.off(RoomEvent.SignalConnected, handleMediaChange);
      room.off(RoomEvent.Connected, handleMediaChange);
      room.off(RoomEvent.Reconnected, handleReconnected);
      room.off(RoomEvent.MediaDevicesError, handleDeviceError);
    };
  }, [room, facingMode, syncMediaState]);

  // Robust Camera Toggle
  const toggleCamera = useCallback(async (): Promise<boolean> => {
    if (!room || !room.localParticipant || isCameraPendingRef.current) {
      return isCameraEnabled;
    }

    const localP = room.localParticipant;
    isCameraPendingRef.current = true;
    setIsCameraPending(true);
    setCameraError(null);

    const currentActual = localP.isCameraEnabled;
    const targetState = !currentActual;
    desiredCameraStateRef.current = targetState;

    console.log(
      `[GraceMeet][Media] Toggle Camera: Current=${currentActual ? "ON" : "OFF"} -> Target=${targetState ? "ON" : "OFF"}`
    );

    try {
      if (targetState) {
        // Turning ON
        await localP.setCameraEnabled(true, { facingMode });
      } else {
        // Turning OFF (mute/unpublish)
        await localP.setCameraEnabled(false);
      }

      syncMediaState();
      return localP.isCameraEnabled;
    } catch (err: unknown) {
      desiredCameraStateRef.current = false;
      let friendlyMessage = "Camera permission or hardware error";
      if (err instanceof Error) {
        if (
          err.name === "NotAllowedError" ||
          err.name === "PermissionDeniedError" ||
          err.message.toLowerCase().includes("permission")
        ) {
          friendlyMessage =
            "Camera permission is blocked. Open browser settings (🔒 icon) and allow camera access for GraceMeet.";
        } else if (
          err.name === "NotFoundError" ||
          err.name === "DevicesNotFoundError" ||
          err.message.toLowerCase().includes("not found")
        ) {
          friendlyMessage = "Camera not found. Please connect a video device.";
        } else if (
          err.name === "NotReadableError" ||
          err.name === "TrackStartError" ||
          err.message.toLowerCase().includes("in use")
        ) {
          friendlyMessage =
            "Camera is already in use by another app. Please close other camera apps and retry.";
        } else {
          friendlyMessage = err.message;
        }
      }
      const error = new Error(friendlyMessage);
      console.error("[GraceMeet][Media] Camera toggle failed:", error);
      setCameraError(error);
      syncMediaState();
      throw error;
    } finally {
      isCameraPendingRef.current = false;
      setIsCameraPending(false);
    }
  }, [room, facingMode, isCameraEnabled, syncMediaState]);

  // Robust Microphone Toggle
  const toggleMicrophone = useCallback(async (): Promise<boolean> => {
    if (!room || !room.localParticipant || isMicPendingRef.current) {
      return isMicrophoneEnabled;
    }

    const localP = room.localParticipant;
    isMicPendingRef.current = true;
    setIsMicPending(true);
    setMicError(null);

    const currentActual = localP.isMicrophoneEnabled;
    const targetState = !currentActual;
    desiredMicStateRef.current = targetState;

    console.log(
      `[GraceMeet][Media] Toggle Microphone: Current=${currentActual ? "ON" : "OFF"} -> Target=${targetState ? "ON" : "OFF"}`
    );

    try {
      if (targetState) {
        await localP.setMicrophoneEnabled(true);
      } else {
        await localP.setMicrophoneEnabled(false);
      }

      syncMediaState();
      return localP.isMicrophoneEnabled;
    } catch (err: unknown) {
      desiredMicStateRef.current = false;
      let friendlyMessage = "Microphone permission or hardware error";
      if (err instanceof Error) {
        if (
          err.name === "NotAllowedError" ||
          err.name === "PermissionDeniedError" ||
          err.message.toLowerCase().includes("permission")
        ) {
          friendlyMessage =
            "Microphone permission is blocked. Open browser settings (🔒 icon) and allow microphone access for GraceMeet.";
        } else if (
          err.name === "NotFoundError" ||
          err.name === "DevicesNotFoundError"
        ) {
          friendlyMessage =
            "Microphone not found. Please connect an audio input device.";
        } else {
          friendlyMessage = err.message;
        }
      }
      const error = new Error(friendlyMessage);
      console.error("[GraceMeet][Media] Microphone toggle failed:", error);
      setMicError(error);
      syncMediaState();
      throw error;
    } finally {
      isMicPendingRef.current = false;
      setIsMicPending(false);
    }
  }, [room, isMicrophoneEnabled, syncMediaState]);

  // Flip Camera for Mobile Devices
  const flipCamera = useCallback(async () => {
    if (
      !room ||
      !room.localParticipant ||
      !room.localParticipant.isCameraEnabled ||
      isFlippingRef.current
    ) {
      return;
    }

    const localP = room.localParticipant;
    isFlippingRef.current = true;
    const nextFacing = facingMode === "user" ? "environment" : "user";
    console.log(
      `[GraceMeet][Media] Flip Camera: ${facingMode} -> ${nextFacing}`
    );

    try {
      const devices = await Room.getLocalDevices("videoinput");
      if (devices.length > 1) {
        const currentPub = localP.getTrackPublication(Track.Source.Camera);
        const currentDeviceId =
          currentPub?.track?.mediaStreamTrack?.getSettings()?.deviceId;
        const otherDevice = devices.find(
          (d) => d.deviceId && d.deviceId !== currentDeviceId
        );
        if (otherDevice) {
          await room.switchActiveDevice("videoinput", otherDevice.deviceId);
          setFacingMode(nextFacing);
          syncMediaState();
          return;
        }
      }

      // Fallback: cycle camera with alternate facingMode
      await localP.setCameraEnabled(false);
      await new Promise((r) => setTimeout(r, 120));
      await localP.setCameraEnabled(true, { facingMode: nextFacing });
      setFacingMode(nextFacing);
      syncMediaState();
    } catch (err) {
      console.error("[GraceMeet][Media] Flip camera error:", err);
    } finally {
      isFlippingRef.current = false;
    }
  }, [room, facingMode, syncMediaState]);

  const clearErrors = useCallback(() => {
    setCameraError(null);
    setMicError(null);
  }, []);

  const cameraPublication = room?.localParticipant?.getTrackPublication(
    Track.Source.Camera
  );
  const microphonePublication = room?.localParticipant?.getTrackPublication(
    Track.Source.Microphone
  );

  return {
    isCameraEnabled,
    isMicrophoneEnabled,
    isCameraPending,
    isMicPending,
    cameraError,
    micError,
    cameraPublication,
    microphonePublication,
    facingMode,
    hasMultipleCameras,
    toggleCamera,
    toggleMicrophone,
    flipCamera,
    syncMediaState,
    clearErrors,
  };
}
