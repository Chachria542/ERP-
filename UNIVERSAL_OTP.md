# 🔐 Universal Testing OTP

## Quick Reference

**UNIVERSAL OTP for Testing: `0000`**

This OTP will **ALWAYS WORK** for any mobile number during testing.

---

## How to Use

### For Farmer Payment Pre-Entry:

1. Go to **Pre-Entry** page
2. Select transaction type: **Farmer Purchase 🚜**
3. Enter **ANY mobile number** (e.g., 9876543210, 1111111111, etc.)
4. Click **"Send OTP"** (optional - you can skip this step)
5. Enter OTP: **0000**
6. Click **"Verify OTP"**
7. ✅ Success! Mobile verified

---

## Features

✅ **Works for ANY mobile number**
✅ **No need to check backend logs**
✅ **No expiration time**
✅ **No rate limiting**
✅ **Instant verification**

---

## Examples

### Example 1: New Farmer
```
Mobile: 9999888877
OTP: 0000
Result: ✅ Verified instantly
```

### Example 2: Another Test
```
Mobile: 1234567890
OTP: 0000
Result: ✅ Verified instantly
```

### Example 3: Any Number
```
Mobile: <ANY_10_DIGIT_NUMBER>
OTP: 0000
Result: ✅ Always works!
```

---

## Alternative Methods (If you want real OTPs)

### Method 1: Watch Logs Real-time
```bash
tail -f /var/log/supervisor/backend.out.log | grep "MOCK SMS"
```

When you click "Send OTP", you'll see:
```
📱 [MOCK SMS] Sending OTP to 9876543210: 1234
```

### Method 2: Get Latest OTP from Database
```bash
cd /app/scripts
python3 get_latest_otp.py 9876543210
```

### Method 3: Create Custom OTP
```bash
/app/scripts/create_test_otp.sh 9876543210
```

---

## Important Notes

⚠️ **This is for TESTING/DEVELOPMENT only**
- Universal OTP (0000) should be disabled in production
- Real SMS gateway will be used in production
- This feature is only for development convenience

🎯 **Recommended for Testing:**
- Use **0000** for quick testing
- Use real OTPs from logs for comprehensive testing

---

## Technical Details

- **Universal OTP**: `0000`
- **Location**: `/app/backend/otp_endpoints.py`
- **Logic**: Checks for universal OTP before database lookup
- **Auto-verification**: Automatically marks farmer as verified

---

## Troubleshooting

**Q: Universal OTP not working?**
- Make sure backend is running: `sudo supervisorctl status backend`
- Make sure you're entering exactly: `0000` (four zeros)
- Check backend logs: `tail -n 20 /var/log/supervisor/backend.out.log`

**Q: Want to disable universal OTP?**
- Edit `/app/backend/otp_endpoints.py`
- Comment out the universal OTP section (lines with UNIVERSAL_OTP)
- Restart backend

---

**Happy Testing! 🚀**
