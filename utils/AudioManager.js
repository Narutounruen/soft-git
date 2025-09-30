// AudioManager.js - รวบรวมฟังก์ชันการจัดการเสียงที่ใช้ซ้ำ
import Sound from 'react-native-sound';
import InCallManager from 'react-native-incall-manager';
import { Platform, Vibration, NativeModules } from 'react-native';

export class AudioManager {
  /**
   * หยุดเสียงเรียกเข้าทุกประเภท
   * @param {Object} ringtoneRef - Reference ของเสียงเรียกเข้า
   */
  static stopAllRingtones(ringtoneRef = null) {
    // หยุดเสียงจาก Sound library
    if (ringtoneRef && ringtoneRef.current) {
      try {
        if (ringtoneRef.current.isPlaying && ringtoneRef.current.isPlaying()) {
          ringtoneRef.current.stop();
        }
        ringtoneRef.current.setNumberOfLoops(0);
      } catch (error) {
        console.error('Error stopping Sound library ringtone:', error);
      }
    }

    // หยุดการสั่น
    try {
      Vibration.cancel();
    } catch (error) {
      console.error('Error stopping vibration:', error);
    }

    // หยุดเสียงจาก InCallManager (ปิดเสียงทั้งหมด)
    try {
      InCallManager.stopRingtone();
      InCallManager.stop({ busytone: false }); // ปิดเสียง busytone
    } catch (error) {
      console.error('Error stopping InCallManager:', error);
    }

    // รีเซ็ต audio category
    try {
      Sound.setCategory('Ambient');
      Sound.setActive(false);
    } catch (error) {
      console.error('Error resetting audio category:', error);
    }
  }

  /**
   * ตั้งค่า audio mode สำหรับการโทร
   * @returns {boolean} - สำเร็จหรือไม่
   */
  static setCallAudioMode() {
    try {
      // ใช้ InCallManager แต่ปิดเสียง connect/disconnect
      InCallManager.start({ 
        media: 'audio', 
        auto: false,  // ปิด auto sound
        ringback: false  // ปิดเสียง ringback
      });
      
      // ตั้งค่า Sound library
      Sound.setCategory('PlayAndRecord', true);
      Sound.setActive(true);

      // สำหรับ Android ใช้ Native Module
      if (Platform.OS === 'android' && NativeModules.AudioManagerModule) {
        NativeModules.AudioManagerModule.setCallAudioMode()
          .catch(error => console.error('Native audio mode error:', error));
      }

      console.log('✅ ตั้งค่า call audio mode สำเร็จ (ไม่มีเสียง connect/disconnect)');
      return true;
    } catch (error) {
      console.error('❌ Error setting call audio mode:', error);
      return false;
    }
  }

  /**
   * รีเซ็ต audio mode เป็นปกติ
   * @returns {boolean} - สำเร็จหรือไม่
   */
  static resetAudioMode() {
    try {
      // หยุด InCallManager โดยไม่เล่นเสียง disconnect
      InCallManager.stop({ busytone: false });
      
      Sound.setCategory('Ambient');
      Sound.setActive(false);

      if (Platform.OS === 'android' && NativeModules.AudioManagerModule) {
        NativeModules.AudioManagerModule.resetAudioMode()
          .catch(error => console.error('Native reset audio error:', error));
      }

      console.log('✅ รีเซ็ต audio mode สำเร็จ (ไม่มีเสียง disconnect)');
      return true;
    } catch (error) {
      console.error('❌ Error resetting audio mode:', error);
      return false;
    }
  }

  /**
   * บังคับเปิดไมโครโฟน
   * @param {Object} callRef - Reference ของสาย
   * @returns {boolean} - สำเร็จหรือไม่
   */
  static async forceMicrophoneEnable(callRef = null) {
    try {
      console.log('🎤 บังคับเปิดไมโครโฟน...');

      // ตั้งค่า audio session
      this.setCallAudioMode();

      // ใช้ Native Module สำหรับ Android
      if (Platform.OS === 'android' && NativeModules.AudioManagerModule) {
        try {
          await NativeModules.AudioManagerModule.forceMicrophoneEnable();
        } catch (error) {
          console.error('Native microphone enable error:', error);
        }
      }

      // Unmute ใน call object
      if (callRef && typeof callRef.mute === 'function') {
        try {
          await callRef.mute(false);
        } catch (error) {
          console.error('Call unmute error:', error);
        }
      }

      console.log('✅ บังคับเปิดไมโครโฟนสำเร็จ');
      return true;
    } catch (error) {
      console.error('❌ Error forcing microphone enable:', error);
      return false;
    }
  }

  /**
   * เปิด/ปิดลำโพง
   * @param {boolean} enable - true = เปิดลำโพง, false = ปิดลำโพง
   * @returns {boolean} - สำเร็จหรือไม่
   */
  static async setSpeakerphone(enable) {
    try {
      if (Platform.OS === 'android' && NativeModules.AudioManagerModule) {
        if (enable) {
          await NativeModules.AudioManagerModule.enableSpeaker();
        } else {
          await NativeModules.AudioManagerModule.disableSpeaker();
        }
      }

      // ใช้ InCallManager
      InCallManager.setSpeakerphoneOn(enable);
      
      console.log(`✅ ${enable ? 'เปิด' : 'ปิด'}ลำโพงสำเร็จ`);
      return true;
    } catch (error) {
      console.error(`❌ Error ${enable ? 'enabling' : 'disabling'} speakerphone:`, error);
      return false;
    }
  }

  /**
   * ปิดเสียงไมโครโฟน
   * @returns {boolean} - สำเร็จหรือไม่
   */
  static muteMicrophone() {
    try {
      InCallManager.setMicrophoneMute(true);
      console.log('✅ ปิดเสียงไมโครโฟนสำเร็จ');
      return true;
    } catch (error) {
      console.error('❌ Error muting microphone:', error);
      return false;
    }
  }

  /**
   * เปิดเสียงไมโครโฟน
   * @returns {boolean} - สำเร็จหรือไม่
   */
  static unmuteMicrophone() {
    try {
      InCallManager.setMicrophoneMute(false);
      console.log('✅ เปิดเสียงไมโครโฟนสำเร็จ');
      return true;
    } catch (error) {
      console.error('❌ Error unmuting microphone:', error);
      return false;
    }
  }

  /**
   * เปิดลำโพง
   * @returns {boolean} - สำเร็จหรือไม่
   */
  static enableSpeaker() {
    return this.setSpeakerphone(true);
  }

  /**
   * ปิดลำโพง
   * @returns {boolean} - สำเร็จหรือไม่
   */
  static disableSpeaker() {
    return this.setSpeakerphone(false);
  }
}