package com.sipproject;

import android.content.Context;
import android.media.AudioManager;
import android.util.Log;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;

public class AudioManagerModule extends ReactContextBaseJavaModule {
    private static final String TAG = "AudioManagerModule";
    private final ReactApplicationContext reactContext;
    private AudioManager audioManager;

    public AudioManagerModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        this.audioManager = (AudioManager) reactContext.getSystemService(Context.AUDIO_SERVICE);
    }

    @Override
    public String getName() {
        return "AudioManagerModule";
    }

    @ReactMethod
    public void setCallAudioMode(Promise promise) {
        try {
            Log.d(TAG, "Setting call audio mode...");
            
            // ตั้งค่าโหมดเสียงสำหรับการโทร
            audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
            
            // ตั้งค่าระดับเสียงให้สูงสุด
            int maxVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_VOICE_CALL);
            audioManager.setStreamVolume(AudioManager.STREAM_VOICE_CALL, maxVolume, 0);
            
            // เปิดไมค์
            audioManager.setMicrophoneMute(false);
            
            // ปิดลำโพงสปีกเกอร์โฟน (ใช้หูฟัง)
            audioManager.setSpeakerphoneOn(false);
            
            Log.d(TAG, "Call audio mode set successfully");
            promise.resolve("Call audio mode set successfully");
        } catch (Exception e) {
            Log.e(TAG, "Error setting call audio mode: " + e.getMessage());
            promise.reject("AUDIO_ERROR", "Error setting call audio mode: " + e.getMessage());
        }
    }

    @ReactMethod
    public void resetAudioMode(Promise promise) {
        try {
            Log.d(TAG, "Resetting audio mode...");
            
            // รีเซ็ตโหมดเสียงเป็นปกติ
            audioManager.setMode(AudioManager.MODE_NORMAL);
            
            // ปิดลำโพงสปีกเกอร์โฟน
            audioManager.setSpeakerphoneOn(false);
            
            Log.d(TAG, "Audio mode reset successfully");
            promise.resolve("Audio mode reset successfully");
        } catch (Exception e) {
            Log.e(TAG, "Error resetting audio mode: " + e.getMessage());
            promise.reject("AUDIO_ERROR", "Error resetting audio mode: " + e.getMessage());
        }
    }

    @ReactMethod
    public void forceMicrophoneEnable(Promise promise) {
        try {
            Log.d(TAG, "Force enabling microphone...");
            
            // บังคับเปิดไมค์
            audioManager.setMicrophoneMute(false);
            
            // ตั้งค่าระดับเสียงไมค์ให้สูงสุด
            int maxVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_VOICE_CALL);
            audioManager.setStreamVolume(AudioManager.STREAM_VOICE_CALL, maxVolume, 0);
            
            // ตั้งค่าโหมดเสียงสำหรับการสื่อสาร
            audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
            
            Log.d(TAG, "Microphone force enabled successfully");
            promise.resolve("Microphone force enabled successfully");
        } catch (Exception e) {
            Log.e(TAG, "Error force enabling microphone: " + e.getMessage());
            promise.reject("AUDIO_ERROR", "Error force enabling microphone: " + e.getMessage());
        }
    }

    @ReactMethod
    public void getMicrophoneStatus(Promise promise) {
        try {
            boolean isMuted = audioManager.isMicrophoneMute();
            int currentVolume = audioManager.getStreamVolume(AudioManager.STREAM_VOICE_CALL);
            int maxVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_VOICE_CALL);
            int currentMode = audioManager.getMode();
            
            String status = String.format(
                "Microphone muted: %b, Volume: %d/%d, Audio mode: %d", 
                isMuted, currentVolume, maxVolume, currentMode
            );
            
            Log.d(TAG, "Microphone status: " + status);
            promise.resolve(status);
        } catch (Exception e) {
            Log.e(TAG, "Error getting microphone status: " + e.getMessage());
            promise.reject("AUDIO_ERROR", "Error getting microphone status: " + e.getMessage());
        }
    }

    @ReactMethod
    public void muteMicrophone(Promise promise) {
        try {
            Log.d(TAG, "Muting microphone...");
            audioManager.setMicrophoneMute(true);
            Log.d(TAG, "Microphone muted successfully");
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Error muting microphone: " + e.getMessage());
            promise.reject("AUDIO_ERROR", "Error muting microphone: " + e.getMessage());
        }
    }

    @ReactMethod
    public void unmuteMicrophone(Promise promise) {
        try {
            Log.d(TAG, "Unmuting microphone...");
            audioManager.setMicrophoneMute(false);
            Log.d(TAG, "Microphone unmuted successfully");
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Error unmuting microphone: " + e.getMessage());
            promise.reject("AUDIO_ERROR", "Error unmuting microphone: " + e.getMessage());
        }
    }

    @ReactMethod
    public void enableSpeaker(Promise promise) {
        try {
            Log.d(TAG, "Enabling speaker...");
            audioManager.setSpeakerphoneOn(true);
            Log.d(TAG, "Speaker enabled successfully");
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Error enabling speaker: " + e.getMessage());
            promise.reject("AUDIO_ERROR", "Error enabling speaker: " + e.getMessage());
        }
    }

    @ReactMethod
    public void disableSpeaker(Promise promise) {
        try {
            Log.d(TAG, "Disabling speaker...");
            audioManager.setSpeakerphoneOn(false);
            Log.d(TAG, "Speaker disabled successfully");
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Error disabling speaker: " + e.getMessage());
            promise.reject("AUDIO_ERROR", "Error disabling speaker: " + e.getMessage());
        }
    }
}
