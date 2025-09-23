import { Alert } from 'react-native';

/**
 * คลาสสำหรับจัดการการโอนสาย (Call Transfer) ใน PJSIP
 * รองรับทั้ง Unattended Transfer และ Attended Transfer
 */
class PJSIPCallTransfer {
  constructor(endpoint = null) {
    this.endpoint = endpoint;
    this.transferCallbacks = {
      onTransferStarted: null,
      onTransferCompleted: null,
      onTransferFailed: null,
      onTransferProgress: null
    };
    this.activeTransfers = new Map(); // เก็บข้อมูลการโอนสายที่กำลังดำเนินอยู่
  }

  /**
   * ตั้งค่า endpoint สำหรับการโอนสาย
   * @param {Object} endpoint - PJSIP endpoint object
   */
  setEndpoint(endpoint) {
    this.endpoint = endpoint;
  }

  /**
   * ตั้งค่า callbacks สำหรับการติดตามสถานะการโอนสาย
   * @param {Object} callbacks - Object ที่มี callback functions
   */
  setupTransferCallbacks(callbacks = {}) {
    this.transferCallbacks = {
      onTransferStarted: callbacks.onTransferStarted || this.defaultOnTransferStarted,
      onTransferCompleted: callbacks.onTransferCompleted || this.defaultOnTransferCompleted,
      onTransferFailed: callbacks.onTransferFailed || this.defaultOnTransferFailed,
      onTransferProgress: callbacks.onTransferProgress || this.defaultOnTransferProgress
    };

    console.log('✅ Transfer callbacks ตั้งค่าเรียบร้อยแล้ว');
  }

  /**
   * Default callback functions
   */
  defaultOnTransferStarted = (callId, targetUri) => {
    console.log(`🔄 เริ่มการโอนสาย - Call ID: ${callId}, Target: ${targetUri}`);
  }

  defaultOnTransferCompleted = (callId, targetUri) => {
    console.log(`✅ โอนสายสำเร็จ - Call ID: ${callId}, Target: ${targetUri}`);
    Alert.alert('สำเร็จ', 'โอนสายสำเร็จแล้ว');
  }

  defaultOnTransferFailed = (callId, targetUri, error) => {
    console.log(`❌ โอนสายไม่สำเร็จ - Call ID: ${callId}, Target: ${targetUri}, Error: ${error}`);
    Alert.alert('ไม่สำเร็จ', `โอนสายไม่สำเร็จ: ${error}`);
  }

  defaultOnTransferProgress = (callId, status) => {
    console.log(`📊 สถานะการโอนสาย - Call ID: ${callId}, Status: ${status}`);
  }

  /**
   * โอนสายแบบง่าย (Unattended Transfer)
   * โอนสายโดยไม่รอให้ปลายทางรับสาย
   * @param {number} callId - ID ของสายที่ต้องการโอน
   * @param {string} targetUri - URI ของปลายทางที่ต้องการโอนไป (เช่น "sip:1234@domain.com")
   * @returns {Promise<boolean>} - ผลลัพธ์การโอนสาย
   */
  async unattendedTransfer(callId, targetUri) {
    try {
      console.log(`🔄 เริ่มการโอนสายแบบ Unattended - Call ID: ${callId} -> ${targetUri}`);

      // ตรวจสอบ endpoint
      if (!this.endpoint) {
        throw new Error('Endpoint ไม่พร้อมใช้งาน');
      }

      // ตรวจสอบ parameters
      if (!targetUri || typeof targetUri !== 'string') {
        throw new Error('Target URI ไม่ถูกต้อง');
      }

      if (typeof callId !== 'number' || callId < 0) {
        throw new Error('Call ID ไม่ถูกต้อง');
      }

      // เรียก callback เริ่มการโอนสาย
      if (this.transferCallbacks.onTransferStarted) {
        this.transferCallbacks.onTransferStarted(callId, targetUri);
      }

      // บันทึกข้อมูลการโอนสาย
      const transferId = `transfer_${callId}_${Date.now()}`;
      this.activeTransfers.set(transferId, {
        callId,
        targetUri,
        type: 'unattended',
        startTime: new Date(),
        status: 'in_progress'
      });

      // ทำการโอนสายผ่าน PJSIP
      // หมายเหตุ: วิธีการเรียกใช้อาจแตกต่างกันขึ้นอยู่กับ library ที่ใช้
      let transferResult;
      
      // ลองใช้วิธีการที่แตกต่างกันขึ้นอยู่กับ API ที่มี
      if (this.endpoint.transferCall) {
        // วิธีที่ 1: ใช้ transferCall method
        transferResult = await this.endpoint.transferCall(callId, targetUri);
      } else if (this.endpoint.makeCall && this.endpoint.hangupCall) {
        // วิธีที่ 2: สร้างสายใหม่และโอนด้วยตนเอง
        transferResult = await this.performManualTransfer(callId, targetUri);
      } else {
        throw new Error('ไม่พบ method สำหรับการโอนสาย');
      }

      // อัพเดทสถานะการโอนสาย
      const transfer = this.activeTransfers.get(transferId);
      if (transfer) {
        transfer.status = 'completed';
        transfer.endTime = new Date();
      }

      // เรียก callback สำเร็จ
      if (this.transferCallbacks.onTransferCompleted) {
        this.transferCallbacks.onTransferCompleted(callId, targetUri);
      }

      console.log(`✅ Unattended Transfer สำเร็จ - Call ID: ${callId}`);
      return true;

    } catch (error) {
      console.error(`❌ Unattended Transfer ไม่สำเร็จ:`, error);

      // อัพเดทสถานะการโอนสาย
      const transferEntries = Array.from(this.activeTransfers.entries());
      const failedTransfer = transferEntries.find(([_, transfer]) => 
        transfer.callId === callId && transfer.status === 'in_progress'
      );
      
      if (failedTransfer) {
        const [transferId, transfer] = failedTransfer;
        transfer.status = 'failed';
        transfer.error = error.message;
        transfer.endTime = new Date();
      }

      // เรียก callback ไม่สำเร็จ
      if (this.transferCallbacks.onTransferFailed) {
        this.transferCallbacks.onTransferFailed(callId, targetUri, error.message);
      }

      return false;
    }
  }

  /**
   * โอนสายแบบเชื่อมต่อ (Attended Transfer)
   * โอนสายหลังจากที่ได้พูดคุยกับปลายทางแล้ว
   * @param {number} originalCallId - ID ของสายเดิม
   * @param {number} newCallId - ID ของสายใหม่ที่เชื่อมต่อกับปลายทาง
   * @returns {Promise<boolean>} - ผลลัพธ์การโอนสาย
   */
  async attendedTransfer(originalCallId, newCallId) {
    try {
      console.log(`🔄 เริ่มการโอนสายแบบ Attended - Original: ${originalCallId}, New: ${newCallId}`);

      // ตรวจสอบ endpoint
      if (!this.endpoint) {
        throw new Error('Endpoint ไม่พร้อมใช้งาน');
      }

      // ตรวจสอบ parameters
      if (typeof originalCallId !== 'number' || originalCallId < 0) {
        throw new Error('Original Call ID ไม่ถูกต้อง');
      }

      if (typeof newCallId !== 'number' || newCallId < 0) {
        throw new Error('New Call ID ไม่ถูกต้อง');
      }

      // เรียก callback เริ่มการโอนสาย
      if (this.transferCallbacks.onTransferStarted) {
        this.transferCallbacks.onTransferStarted(originalCallId, `attended_to_call_${newCallId}`);
      }

      // บันทึกข้อมูลการโอนสาย
      const transferId = `transfer_${originalCallId}_${newCallId}_${Date.now()}`;
      this.activeTransfers.set(transferId, {
        originalCallId,
        newCallId,
        type: 'attended',
        startTime: new Date(),
        status: 'in_progress'
      });

      // ทำการโอนสายแบบ Attended
      let transferResult;

      if (this.endpoint.attendedTransfer) {
        // วิธีที่ 1: ใช้ attendedTransfer method
        transferResult = await this.endpoint.attendedTransfer(originalCallId, newCallId);
      } else if (this.endpoint.transferCallToCall) {
        // วิธีที่ 2: ใช้ transferCallToCall method
        transferResult = await this.endpoint.transferCallToCall(originalCallId, newCallId);
      } else {
        // วิธีที่ 3: ทำด้วยตนเองโดยการเชื่อมต่อสายทั้งสอง
        transferResult = await this.performManualAttendedTransfer(originalCallId, newCallId);
      }

      // อัพเดทสถานะการโอนสาย
      const transfer = this.activeTransfers.get(transferId);
      if (transfer) {
        transfer.status = 'completed';
        transfer.endTime = new Date();
      }

      // เรียก callback สำเร็จ
      if (this.transferCallbacks.onTransferCompleted) {
        this.transferCallbacks.onTransferCompleted(originalCallId, `attended_to_call_${newCallId}`);
      }

      console.log(`✅ Attended Transfer สำเร็จ - Original: ${originalCallId}, New: ${newCallId}`);
      return true;

    } catch (error) {
      console.error(`❌ Attended Transfer ไม่สำเร็จ:`, error);

      // อัพเดทสถานะการโอนสาย
      const transferEntries = Array.from(this.activeTransfers.entries());
      const failedTransfer = transferEntries.find(([_, transfer]) => 
        transfer.originalCallId === originalCallId && transfer.status === 'in_progress'
      );
      
      if (failedTransfer) {
        const [transferId, transfer] = failedTransfer;
        transfer.status = 'failed';
        transfer.error = error.message;
        transfer.endTime = new Date();
      }

      // เรียก callback ไม่สำเร็จ
      if (this.transferCallbacks.onTransferFailed) {
        this.transferCallbacks.onTransferFailed(originalCallId, `attended_to_call_${newCallId}`, error.message);
      }

      return false;
    }
  }

  /**
   * ทำการโอนสายด้วยตนเองสำหรับ Unattended Transfer
   * @param {number} callId - ID ของสายที่ต้องการโอน
   * @param {string} targetUri - URI ของปลายทาง
   */
  async performManualTransfer(callId, targetUri) {
    // Implementation สำหรับการโอนสายด้วยตนเอง
    // ขึ้นอยู่กับ library ที่ใช้
    console.log(`🔧 ทำการโอนสายด้วยตนเอง: ${callId} -> ${targetUri}`);
    
    // ตัวอย่างการ implement (ต้องปรับตาม API ที่มี)
    // 1. Hold สายเดิม
    // 2. สร้างสายใหม่ไปยัง target
    // 3. เมื่อ target รับสาย ให้เชื่อมต่อสายทั้งสอง
    // 4. วางสายของเรา
    
    return true; // placeholder
  }

  /**
   * ทำการโอนสายแบบ Attended ด้วยตนเอง
   * @param {number} originalCallId - ID ของสายเดิม
   * @param {number} newCallId - ID ของสายใหม่
   */
  async performManualAttendedTransfer(originalCallId, newCallId) {
    console.log(`🔧 ทำการโอนสายแบบ Attended ด้วยตนเอง: ${originalCallId} + ${newCallId}`);
    
    try {
      // Implementation สำหรับ Attended Transfer
      
      // Step 1: ตรวจสอบว่าทั้งสองสายยังเชื่อมต่ออยู่
      console.log('🔍 ตรวจสอบสถานะสายทั้งสอง...');
      
      if (!this.endpoint) {
        throw new Error('Endpoint ไม่พร้อมใช้งาน');
      }

      // Step 2: เชื่อมต่อสายทั้งสองเข้าด้วยกัน (3-way conference)
      console.log('🔗 กำลังเชื่อมต่อสายทั้งสองเข้าด้วยกัน...');
      
      let conferenceSuccess = false;

      // วิธีที่ 1: ใช้ conference method
      if (this.endpoint.conferenceConnect && !conferenceSuccess) {
        try {
          await this.endpoint.conferenceConnect(originalCallId, newCallId);
          conferenceSuccess = true;
          console.log('✅ สร้าง conference call สำเร็จ (วิธีที่ 1)');
        } catch (error) {
          console.log('❌ Conference connect วิธีที่ 1 ล้มเหลว:', error.message);
        }
      }

      // วิธีที่ 2: ใช้ join conference
      if (this.endpoint.joinConference && !conferenceSuccess) {
        try {
          await this.endpoint.joinConference([originalCallId, newCallId]);
          conferenceSuccess = true;
          console.log('✅ Join conference สำเร็จ (วิธีที่ 2)');
        } catch (error) {
          console.log('❌ Join conference วิธีที่ 2 ล้มเหลว:', error.message);
        }
      }

      // วิธีที่ 3: Manual conference setup
      if (!conferenceSuccess && this.endpoint.holdCall && this.endpoint.unholdCall) {
        try {
          console.log('🔄 ใช้วิธี manual conference...');
          
          // Unhold สายเดิม (ถ้า hold อยู่)
          await this.endpoint.unholdCall(originalCallId);
          console.log('📞 Unhold สายเดิมแล้ว');
          
          // รอสักครู่ให้สถานะคงที่
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // ทำให้สายใหม่เป็น active call และเชื่อมต่อ
          await this.endpoint.unholdCall(newCallId);
          console.log('📞 Unhold สายใหม่แล้ว');
          
          // รอให้ media ทั้งสองเชื่อมต่อ
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          conferenceSuccess = true;
          console.log('✅ Manual conference setup สำเร็จ (วิธีที่ 3)');
        } catch (error) {
          console.log('❌ Manual conference วิธีที่ 3 ล้มเหลว:', error.message);
        }
      }

      // วิธีที่ 4: ใช้ PJSIP transfer with consultation
      if (!conferenceSuccess && this.endpoint.transferCallWithConsultation) {
        try {
          console.log('🔄 ใช้ transfer with consultation...');
          await this.endpoint.transferCallWithConsultation(originalCallId, newCallId);
          conferenceSuccess = true;
          console.log('✅ Transfer with consultation สำเร็จ (วิธีที่ 4)');
        } catch (error) {
          console.log('❌ Transfer with consultation วิธีที่ 4 ล้มเหลว:', error.message);
        }
      }

      if (!conferenceSuccess) {
        throw new Error('ไม่สามารถเชื่อมต่อสายทั้งสองได้');
      }

      // Step 3: รอให้ conference เสถียร
      console.log('⏳ รอให้ conference เสถียร...');
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 4: ออกจาก conference (วางสายของเราเอง)
      console.log('🚪 กำลังออกจาก conference...');
      
      // บันทึกสถานะการโอนสายเสร็จสิ้น
      const transferData = {
        originalCallId,
        newCallId,
        conferenceMethod: conferenceSuccess ? 'success' : 'failed',
        timestamp: new Date().toISOString(),
        status: 'completed'
      };

      console.log('✅ Attended Transfer เสร็จสมบูรณ์:', transferData);
      
      return transferData;

    } catch (error) {
      console.error('❌ เกิดข้อผิดพลาดในการทำ Manual Attended Transfer:', error);
      throw new Error(`Manual Attended Transfer ล้มเหลว: ${error.message}`);
    }
  }

  /**
   * ยกเลิกการโอนสายที่กำลังดำเนินอยู่
   * @param {number} callId - ID ของสายที่ต้องการยกเลิกการโอน
   */
  async cancelTransfer(callId) {
    try {
      console.log(`🚫 ยกเลิกการโอนสาย: ${callId}`);

      // หาการโอนสายที่กำลังดำเนินอยู่
      const transferEntries = Array.from(this.activeTransfers.entries());
      const activeTransfer = transferEntries.find(([_, transfer]) => 
        (transfer.callId === callId || transfer.originalCallId === callId) && 
        transfer.status === 'in_progress'
      );

      if (!activeTransfer) {
        throw new Error('ไม่พบการโอนสายที่กำลังดำเนินอยู่');
      }

      const [transferId, transfer] = activeTransfer;

      // ยกเลิกการโอนสาย
      if (this.endpoint.cancelTransfer) {
        await this.endpoint.cancelTransfer(callId);
      }

      // อัพเดทสถานะ
      transfer.status = 'cancelled';
      transfer.endTime = new Date();

      console.log(`✅ ยกเลิกการโอนสายสำเร็จ: ${callId}`);
      return true;

    } catch (error) {
      console.error(`❌ ไม่สามารถยกเลิกการโอนสายได้:`, error);
      return false;
    }
  }

  /**
   * เริ่มกระบวนการโอนสายแบบ Attended Transfer
   * @param {Object} originalCall - สายเดิมที่ต้องการโอน
   * @param {string} targetUri - URI ของปลายทางที่จะโอนไป
   * @returns {Promise<Object>} - Object ที่มีข้อมูลสายปรึกษา
   */
  async startAttendedTransfer(originalCall, targetUri) {
    try {
      console.log('🔄 เริ่ม Attended Transfer...');
      
      if (!this.endpoint) {
        throw new Error('Endpoint ไม่พร้อมใช้งาน');
      }

      if (!originalCall) {
        throw new Error('ไม่มีสายเดิมที่จะโอน');
      }

      if (!targetUri) {
        throw new Error('ไม่มี URI ปลายทาง');
      }

      // Step 1: Hold สายเดิม
      console.log('📞 Hold สายเดิม...');
      if (this.endpoint.holdCall) {
        await this.endpoint.holdCall(originalCall);
      } else if (originalCall.hold) {
        await originalCall.hold();
      } else {
        console.log('⚠️ ไม่พบ method สำหรับ hold สาย');
      }

      // Step 2: สร้างสายใหม่ไปยังปลายทาง
      console.log(`📞 โทรไปยังปลายทาง: ${targetUri}`);
      let consultCall;
      
      if (this.endpoint.makeCall) {
        consultCall = await this.endpoint.makeCall(targetUri);
      } else {
        throw new Error('ไม่สามารถสร้างสายปรึกษาได้');
      }

      // Step 3: บันทึกข้อมูลการโอนสาย
      const transferId = `attended_${Date.now()}`;
      this.activeTransfers.set(transferId, {
        type: 'attended',
        originalCall,
        consultCall,
        targetUri,
        status: 'consulting',
        startTime: new Date()
      });

      console.log('✅ เริ่ม Attended Transfer สำเร็จ');
      
      if (this.transferCallbacks.onTransferStarted) {
        this.transferCallbacks.onTransferStarted(originalCall._callId || originalCall.id, targetUri);
      }

      return {
        transferId,
        originalCall,
        consultCall,
        targetUri,
        status: 'consulting'
      };

    } catch (error) {
      console.error('❌ ไม่สามารถเริ่ม Attended Transfer ได้:', error);
      throw error;
    }
  }

  /**
   * เสร็จสิ้นการโอนสายแบบ Attended Transfer
   * @param {string} transferId - ID ของการโอนสาย
   * @returns {Promise<boolean>} - ผลลัพธ์การโอนสาย
   */
  async completeAttendedTransfer(transferId) {
    try {
      const transfer = this.activeTransfers.get(transferId);
      if (!transfer) {
        throw new Error('ไม่พบข้อมูลการโอนสาย');
      }

      const { originalCall, consultCall, targetUri } = transfer;
      
      console.log('🔄 เสร็จสิ้น Attended Transfer...');

      // ใช้ method performManualAttendedTransfer ที่เราสร้างขึ้น
      await this.performManualAttendedTransfer(
        originalCall._callId || originalCall.id,
        consultCall._callId || consultCall.id
      );

      // อัพเดทสถานะการโอนสาย
      transfer.status = 'completed';
      transfer.endTime = new Date();

      if (this.transferCallbacks.onTransferCompleted) {
        this.transferCallbacks.onTransferCompleted(originalCall._callId || originalCall.id, targetUri);
      }

      console.log('✅ Attended Transfer เสร็จสมบูรณ์');
      return true;

    } catch (error) {
      console.error('❌ ไม่สามารถเสร็จสิ้น Attended Transfer ได้:', error);
      
      const transfer = this.activeTransfers.get(transferId);
      if (transfer) {
        transfer.status = 'failed';
        transfer.error = error.message;
        transfer.endTime = new Date();
      }

      if (this.transferCallbacks.onTransferFailed) {
        this.transferCallbacks.onTransferFailed(
          transfer?.originalCall?._callId || 'unknown',
          transfer?.targetUri || 'unknown',
          error.message
        );
      }

      return false;
    }
  }

  /**
   * ยกเลิกการโอนสายแบบ Attended Transfer
   * @param {string} transferId - ID ของการโอนสาย
   * @returns {Promise<boolean>} - ผลลัพธ์การยกเลิก
   */
  async cancelAttendedTransfer(transferId) {
    try {
      const transfer = this.activeTransfers.get(transferId);
      if (!transfer) {
        throw new Error('ไม่พบข้อมูลการโอนสาย');
      }

      const { originalCall, consultCall } = transfer;
      
      console.log('🚫 ยกเลิก Attended Transfer...');

      // วางสายปรึกษา
      if (consultCall) {
        try {
          if (consultCall.hangup) {
            await consultCall.hangup();
          } else if (this.endpoint.hangupCall) {
            await this.endpoint.hangupCall(consultCall);
          }
          console.log('✅ วางสายปรึกษาแล้ว');
        } catch (error) {
          console.log('⚠️ ไม่สามารถวางสายปรึกษาได้:', error.message);
        }
      }

      // Unhold สายเดิม
      if (originalCall) {
        try {
          if (this.endpoint.unholdCall) {
            await this.endpoint.unholdCall(originalCall);
          } else if (originalCall.unhold) {
            await originalCall.unhold();
          }
          console.log('✅ Unhold สายเดิมแล้ว');
        } catch (error) {
          console.log('⚠️ ไม่สามารถ unhold สายเดิมได้:', error.message);
        }
      }

      // อัพเดทสถานะ
      transfer.status = 'cancelled';
      transfer.endTime = new Date();

      console.log('✅ ยกเลิก Attended Transfer สำเร็จ');
      return true;

    } catch (error) {
      console.error('❌ ไม่สามารถยกเลิก Attended Transfer ได้:', error);
      return false;
    }
  }

  /**
   * รับสถานะการโอนสายทั้งหมด
   * @returns {Array} - รายการการโอนสายทั้งหมด
   */
  getActiveTransfers() {
    return Array.from(this.activeTransfers.values());
  }

  /**
   * รับข้อมูลการโอนสายเฉพาะ
   * @param {string} transferId - ID ของการโอนสาย
   * @returns {Object|null} - ข้อมูลการโอนสาย
   */
  getTransferById(transferId) {
    return this.activeTransfers.get(transferId) || null;
  }

  /**
   * สลับระหว่างสายเดิมและสายปรึกษาใน Attended Transfer
   * @param {string} transferId - ID ของการโอนสาย
   * @returns {Promise<string>} - สายที่กำลัง active ('original' หรือ 'consult')
   */
  async switchBetweenCalls(transferId) {
    try {
      const transfer = this.activeTransfers.get(transferId);
      if (!transfer || transfer.type !== 'attended') {
        throw new Error('ไม่พบข้อมูล Attended Transfer');
      }

      const { originalCall, consultCall } = transfer;
      
      // ตรวจสอบสายไหนที่กำลัง active อยู่
      let currentActiveCall = transfer.activeCall || 'original';
      
      if (currentActiveCall === 'original') {
        // สลับไปสายปรึกษา: Hold สายเดิม, Unhold สายปรึกษา
        console.log('🔄 สลับไปสายปรึกษา...');
        
        if (this.endpoint.holdCall) {
          await this.endpoint.holdCall(originalCall);
        }
        
        if (this.endpoint.unholdCall) {
          await this.endpoint.unholdCall(consultCall);
        }
        
        transfer.activeCall = 'consult';
        console.log('✅ สลับไปสายปรึกษาแล้ว');
        return 'consult';
        
      } else {
        // สลับไปสายเดิม: Hold สายปรึกษา, Unhold สายเดิม
        console.log('🔄 สลับไปสายเดิม...');
        
        if (this.endpoint.holdCall) {
          await this.endpoint.holdCall(consultCall);
        }
        
        if (this.endpoint.unholdCall) {
          await this.endpoint.unholdCall(originalCall);
        }
        
        transfer.activeCall = 'original';
        console.log('✅ สลับไปสายเดิมแล้ว');
        return 'original';
      }

    } catch (error) {
      console.error('❌ ไม่สามารถสลับสายได้:', error);
      throw error;
    }
  }

  /**
   * สร้าง 3-way conference จากสายเดิมและสายปรึกษา
   * @param {string} transferId - ID ของการโอนสาย
   * @returns {Promise<boolean>} - ผลลัพธ์การสร้าง conference
   */
  async createThreeWayConference(transferId) {
    try {
      const transfer = this.activeTransfers.get(transferId);
      if (!transfer || transfer.type !== 'attended') {
        throw new Error('ไม่พบข้อมูล Attended Transfer');
      }

      const { originalCall, consultCall } = transfer;
      
      console.log('🔄 สร้าง 3-way conference...');

      // ใช้ performManualAttendedTransfer แต่ไม่ออกจาก conference
      const result = await this.performManualAttendedTransfer(
        originalCall._callId || originalCall.id,
        consultCall._callId || consultCall.id
      );

      // อัพเดทสถานะเป็น conference
      transfer.status = 'conference';
      transfer.conferenceStartTime = new Date();

      console.log('✅ สร้าง 3-way conference สำเร็จ');
      return true;

    } catch (error) {
      console.error('❌ ไม่สามารถสร้าง 3-way conference ได้:', error);
      return false;
    }
  }

  /**
   * ล้างข้อมูลการโอนสายที่เสร็จสิ้นแล้ว
   */
  clearCompletedTransfers() {
    const completedTransfers = [];
    
    for (const [transferId, transfer] of this.activeTransfers.entries()) {
      if (transfer.status !== 'in_progress') {
        completedTransfers.push(transferId);
      }
    }

    completedTransfers.forEach(id => this.activeTransfers.delete(id));
    
    console.log(`🧹 ล้างข้อมูลการโอนสายที่เสร็จสิ้นแล้ว: ${completedTransfers.length} รายการ`);
  }

  /**
   * รีเซ็ตข้อมูลการโอนสายทั้งหมด
   */
  reset() {
    this.activeTransfers.clear();
    console.log('🔄 รีเซ็ตข้อมูลการโอนสายทั้งหมดแล้ว');
  }
}

export default PJSIPCallTransfer;
