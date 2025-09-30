// TransferManager.js - รวบรวมฟังก์ชันการโอนสายที่ใช้ซ้ำ
import { CallManager } from './CallManager.js';

export class TransferManager {
  /**
   * สร้าง SIP URI สำหรับโอนสาย
   * @param {string} targetNumber - หมายเลขปลายทาง
   * @param {Object} config - การตั้งค่า SIP
   * @returns {string} - SIP URI
   */
  static createSipUri(targetNumber, config) {
    if (targetNumber.includes('@')) {
      return targetNumber;
    }

    const domain = config && config.domain ? config.domain : 'your-sip-domain.com';
    return `sip:${targetNumber.trim()}@${domain}`;
  }

  /**
   * โอนสายแบบ Unattended (โอนทันที)
   * @param {Object} params - พารามิเตอร์ { endpointRef, accountRef, currentCallRef, targetNumber, config }
   * @returns {boolean} - สำเร็จหรือไม่
   */
  static async performUnattendedTransfer({ 
    endpointRef, 
    accountRef, 
    currentCallRef, 
    targetNumber, 
    config 
  }) {
    try {
      const targetUri = this.createSipUri(targetNumber, config);
      console.log('🔄 เริ่มโอนสายแบบ Unattended ไป:', targetUri);

      let transferSuccess = false;

      // วิธีที่ 1: ใช้ endpointRef.xferCall
      if (!transferSuccess && endpointRef && typeof endpointRef.xferCall === 'function') {
        try {
          await endpointRef.xferCall(accountRef, currentCallRef, targetUri);
          transferSuccess = true;
          console.log('✅ โอนสายสำเร็จด้วย endpointRef.xferCall');
        } catch (error) {
          console.log('❌ endpointRef.xferCall ล้มเหลว:', error.message);
        }
      }

      // วิธีที่ 2: ใช้ currentCallRef.transfer
      if (!transferSuccess && currentCallRef && typeof currentCallRef.transfer === 'function') {
        try {
          await currentCallRef.transfer(targetUri);
          transferSuccess = true;
          console.log('✅ โอนสายสำเร็จด้วย currentCallRef.transfer');
        } catch (error) {
          console.log('❌ currentCallRef.transfer ล้มเหลว:', error.message);
        }
      }

      // วิธีที่ 3: ใช้ endpointRef.transferCall
      if (!transferSuccess && endpointRef && typeof endpointRef.transferCall === 'function') {
        try {
          await endpointRef.transferCall(currentCallRef, targetUri);
          transferSuccess = true;
          console.log('✅ โอนสายสำเร็จด้วย endpointRef.transferCall');
        } catch (error) {
          console.log('❌ endpointRef.transferCall ล้มเหลว:', error.message);
        }
      }

      if (!transferSuccess) {
        throw new Error('ไม่พบฟังก์ชันโอนสายที่สามารถใช้งานได้');
      }

      return true;
    } catch (error) {
      console.error('❌ การโอนสายล้มเหลว:', error.message);
      return false;
    }
  }

  /**
   * โอนสายแบบ Attended (ปรึกษาก่อนโอน)
   * @param {Object} params - พารามิเตอร์สำหรับโอนสาย
   * @returns {boolean} - สำเร็จหรือไม่
   */
  static async performAttendedTransfer({ 
    endpointRef, 
    accountRef, 
    originalCallRef, 
    consultCallRef, 
    targetNumber, 
    config 
  }) {
    try {
      const targetUri = this.createSipUri(targetNumber, config);
      console.log('🔄 เริ่มโอนสายแบบ Attended ไป:', targetUri);

      // วางสายปรึกษาก่อน (ถ้ามี)
      if (consultCallRef) {
        try {
          await CallManager.hangupCall(consultCallRef);
          console.log('✅ วางสายปรึกษาแล้ว');
        } catch (error) {
          console.log('⚠️ ไม่สามารถวางสายปรึกษาได้:', error.message);
        }
      }

      // โอนสายเดิม
      return await this.performUnattendedTransfer({
        endpointRef,
        accountRef,
        currentCallRef: originalCallRef,
        targetNumber,
        config
      });
    } catch (error) {
      console.error('❌ การโอนสายแบบ Attended ล้มเหลว:', error.message);
      return false;
    }
  }

  /**
   * เริ่มสายปรึกษาสำหรับ Attended Transfer
   * @param {Object} params - พารามิเตอร์ { endpointRef, accountRef, targetNumber, config }
   * @returns {Object|null} - Call reference หรือ null
   */
  static async startConsultCall({ endpointRef, accountRef, targetNumber, config }) {
    try {
      const targetUri = this.createSipUri(targetNumber, config);
      console.log('📞 เริ่มสายปรึกษาไป:', targetUri);

      const consultCall = await endpointRef.makeCall(accountRef, targetUri, {
        headers: {
          'X-Transfer-Type': 'Consult-Call',
        },
      });

      console.log('✅ สร้างสายปรึกษาสำเร็จ');
      return consultCall;
    } catch (error) {
      console.error('❌ การสร้างสายปรึกษาล้มเหลว:', error.message);
      return null;
    }
  }

  /**
   * ตรวจสอบสถานะสายก่อนโอน
   * @param {Object} callRef - Reference ของสาย
   * @param {Function} unholdFunction - ฟังก์ชัน unhold
   * @returns {boolean} - พร้อมโอนหรือไม่
   */
  static async prepareCallForTransfer(callRef, unholdFunction = null) {
    if (!callRef) {
      console.log('❌ ไม่พบสายที่ต้องโอน');
      return false;
    }

    try {
      // ตรวจสอบว่าสายอยู่ใน hold หรือไม่
      const isOnHold = callRef.isOnHold ? callRef.isOnHold() : false;
      
      if (isOnHold && unholdFunction) {
        console.log('📞 Unhold สายก่อนโอน...');
        await unholdFunction();
        
        // รอให้ unhold เสร็จ
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log('✅ สายพร้อมสำหรับการโอนแล้ว');
      return true;
    } catch (error) {
      console.error('❌ ไม่สามารถเตรียมสายสำหรับการโอน:', error.message);
      return false;
    }
  }
}