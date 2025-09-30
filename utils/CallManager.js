// CallManager.js - รวบรวมฟังก์ชันการจัดการสายที่ใช้ซ้ำ
export class CallManager {
  /**
   * วางสายด้วยวิธีการหลายแบบ
   * @param {Object} callRef - Reference ของสาย
   * @param {Object} endpointRef - Endpoint reference
   * @returns {boolean} - สำเร็จหรือไม่
   */
  static async hangupCall(callRef, endpointRef = null) {
    if (!callRef) {
      console.log('ไม่พบสายที่ต้องวาง');
      return false;
    }

    let terminated = false;

    // วิธีที่ 1: ใช้ call.hangup()
    if (!terminated && typeof callRef.hangup === 'function') {
      try {
        await callRef.hangup();
        console.log('✅ วางสายสำเร็จด้วย hangup()');
        terminated = true;
      } catch (error) {
        console.log('❌ hangup() ล้มเหลว:', error.message);
      }
    }

    // วิธีที่ 2: ใช้ call.terminate()
    if (!terminated && typeof callRef.terminate === 'function') {
      try {
        await callRef.terminate();
        console.log('✅ วางสายสำเร็จด้วย terminate()');
        terminated = true;
      } catch (error) {
        console.log('❌ terminate() ล้มเหลว:', error.message);
      }
    }

    // วิธีที่ 3: ใช้ endpoint.hangupCall()
    if (!terminated && endpointRef && typeof endpointRef.hangupCall === 'function') {
      try {
        await endpointRef.hangupCall(callRef);
        console.log('✅ วางสายสำเร็จด้วย endpoint.hangupCall()');
        terminated = true;
      } catch (error) {
        console.log('❌ endpoint.hangupCall() ล้มเหลว:', error.message);
      }
    }

    return terminated;
  }

  /**
   * ตรวจสอบสถานะการเชื่อมต่อของสาย
   * @param {Object} callRef - Reference ของสาย
   * @returns {string} - สถานะของสาย
   */
  static getCallStatus(callRef) {
    if (!callRef) return 'no_call';
    
    if (callRef.state) {
      return callRef.state;
    }
    
    // ตรวจสอบ properties อื่นๆ
    if (callRef.isConnected && callRef.isConnected()) {
      return 'connected';
    }
    
    return 'unknown';
  }

  /**
   * Mute/Unmute ไมโครโฟน
   * @param {Object} callRef - Reference ของสาย
   * @param {boolean} shouldMute - true = mute, false = unmute
   * @returns {boolean} - สำเร็จหรือไม่
   */
  static async setMute(callRef, shouldMute) {
    if (!callRef || typeof callRef.mute !== 'function') {
      console.log('ไม่สามารถ mute/unmute ได้');
      return false;
    }

    try {
      await callRef.mute(shouldMute);
      console.log(`✅ ${shouldMute ? 'Mute' : 'Unmute'} สำเร็จ`);
      return true;
    } catch (error) {
      console.log(`❌ ${shouldMute ? 'Mute' : 'Unmute'} ล้มเหลว:`, error.message);
      return false;
    }
  }

  /**
   * Hold สาย - รวบรวมจากโค้ดซ้ำใน App.js
   * @param {Object} callRef - Reference ของสาย
   * @param {Object} endpointRef - Endpoint reference
   * @returns {boolean} - สำเร็จหรือไม่
   */
  static async holdCall(callRef, endpointRef) {
    if (!callRef) {
      throw new Error('ไม่มีสายที่กำลังโทรอยู่');
    }

    try {
      let holdSuccess = false;

      // ใช้ endpoint holdCall
      if (endpointRef && endpointRef.holdCall) {
        try {
          await endpointRef.holdCall(callRef);
          holdSuccess = true;
        } catch (error) {
          console.log('Hold failed:', error);
        }
      }

      if (holdSuccess) {
        return true;
      } else {
        throw new Error('ไม่สามารถ Hold สายได้');
      }
    } catch (error) {
      console.error('Hold call error:', error);
      throw error;
    }
  }

  /**
   * Unhold สาย - รวบรวมจากโค้ดซ้ำใน App.js
   * @param {Object} callRef - Reference ของสาย
   * @param {Object} endpointRef - Endpoint reference
   * @returns {boolean} - สำเร็จหรือไม่
   */
  static async unholdCall(callRef, endpointRef) {
    if (!callRef) {
      throw new Error('ไม่พบสายที่ต้องการ Unhold');
    }

    try {
      let unholdSuccess = false;

      // ใช้ endpoint unholdCall
      if (endpointRef && endpointRef.unholdCall) {
        try {
          await endpointRef.unholdCall(callRef);
          unholdSuccess = true;
        } catch (error) {
          console.log('Unhold failed:', error);
        }
      }

      if (unholdSuccess) {
        return true;
      } else {
        throw new Error('ไม่สามารถ Unhold สายได้');
      }
    } catch (error) {
      console.error('Unhold call error:', error);
      throw error;
    }
  }

  /**
   * Hold/Unhold สาย (รวม 2 ฟังก์ชัน)
   * @param {Object} callRef - Reference ของสาย
   * @param {boolean} shouldHold - true = hold, false = unhold
   * @returns {boolean} - สำเร็จหรือไม่
   */
  static async setHold(callRef, shouldHold) {
    if (!callRef) {
      console.log('ไม่พบสายที่ต้อง hold/unhold');
      return false;
    }

    const method = shouldHold ? 'hold' : 'unhold';
    
    if (typeof callRef[method] === 'function') {
      try {
        await callRef[method]();
        console.log(`✅ ${shouldHold ? 'Hold' : 'Unhold'} สำเร็จ`);
        return true;
      } catch (error) {
        console.log(`❌ ${shouldHold ? 'Hold' : 'Unhold'} ล้มเหลว:`, error.message);
        return false;
      }
    }

    console.log(`ไม่พบฟังก์ชัน ${method}()`);
    return false;
  }

  /**
   * ทำการโทรออก
   * @param {Object} endpointRef - Endpoint reference
   * @param {Object} accountRef - Account reference  
   * @param {string} callUri - URI ที่จะโทรไป
   * @param {Object} options - ตัวเลือกเพิ่มเติม
   * @returns {Object|null} - Call object หรือ null ถ้าโทรไม่สำเร็จ
   */
  static async makeCall(endpointRef, accountRef, callUri, options = {}) {
    if (!endpointRef || !accountRef || !callUri) {
      console.log('❌ ข้อมูลไม่ครบสำหรับการโทร');
      return null;
    }

    try {
      console.log(`📞 โทรออกไปยัง: ${callUri}`);
      const call = await endpointRef.makeCall(accountRef, callUri, options);
      console.log('✅ เริ่มการโทรสำเร็จ');
      return call;
    } catch (error) {
      console.log('❌ การโทรล้มเหลว:', error.message);
      throw error;
    }
  }
}