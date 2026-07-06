# QUICK TEST GUIDE - Stage 1 Video Player

## 🚀 START TESTING NOW

### 1. Start Expo Dev Server
```bash
cd artifacts/mobile
npx expo start -c
```
(The `-c` clears cache for clean start)

---

## 🌐 TEST ON WEB

### Steps:
1. Press **`w`** in terminal
2. Browser opens at http://localhost:8081
3. Login (any email/password works)
4. Go to **Courses** tab
5. Click **"Robotics for Beginners"** or **"Electronics"**
6. Click **"Continue Learning"** button
7. **Video player appears!** 🎬

### What to Check:
- ✅ Video plays automatically
- ✅ 16:9 aspect ratio
- ✅ Tap anywhere → Controls appear
- ✅ Tap again → Controls hide
- ✅ Controls auto-hide after 3 seconds
- ✅ Progress bar fills up
- ✅ Time updates (0:05 / 0:10)
- ✅ Large center play/pause button works
- ✅ Bottom play/pause button works
- ✅ Fullscreen button visible

---

## 📱 TEST ON EXPO GO

### Steps:
1. Install **Expo Go** app on phone (if not installed)
   - Android: Google Play Store
   - iOS: App Store

2. After `npx expo start`:
   - Scan QR code with Expo Go app
   - Or: Camera app → Opens in Expo Go

3. Same testing steps as Web above

### What to Check:
- ✅ Video plays smoothly
- ✅ Touch controls responsive
- ✅ No lag or stuttering
- ✅ Native player performance

---

## 🤖 TEST ON ANDROID EMULATOR

### Steps:
1. Ensure Android Studio installed
2. Start emulator first, OR:
   ```bash
   npx expo start --android
   ```
   (Auto-starts emulator)

3. Same testing steps as above

---

## 🎯 EXPECTED BEHAVIOR

### On Load:
1. Video player appears (black 16:9 box)
2. Video auto-starts playing
3. Controls visible initially
4. After 3 seconds → Controls fade out

### During Playback:
1. Progress bar fills left to right
2. Time updates: "0:03 / 0:10" → "0:04 / 0:10"
3. Tap anywhere → Controls reappear
4. Wait 3 seconds → Controls hide again

### Controls:
1. **Center Button:** Large play/pause (when controls visible)
2. **Bottom Button:** Small play/pause (always in bottom bar)
3. **Progress Bar:** Shows playback progress (visual only)
4. **Time:** "Current / Total" format
5. **Fullscreen:** Icon in top-right (UI only, no native fullscreen yet)

---

## ❌ KNOWN LIMITATIONS (Stage 1)

These are **intentional** for Stage 1 foundation:

1. ❌ **Cannot seek** - Tapping progress bar doesn't jump
2. ❌ **No resume** - Always starts from beginning
3. ❌ **No speed control** - Plays at 1x only
4. ❌ **Fullscreen button** - Shows icon but doesn't enter fullscreen
5. ❌ **Progress not saved** - Reloading page resets progress

**These can be added in Stage 2!**

---

## 🐛 TROUBLESHOOTING

### Issue: Video doesn't play
**Check:**
- Internet connection
- Video URL accessible
- Console for errors

### Issue: Controls don't appear
**Try:**
- Tap anywhere on video
- Check if `showControls` state working
- Refresh app

### Issue: Blank black screen
**Check:**
- Video URL is valid MP4
- Network allows video loading
- Console errors

### Issue: Metro bundler error
**Fix:**
```bash
npx expo start -c
```
(Clears cache)

---

## 📊 TEST CHECKLIST

### Basic Playback:
- [ ] Video loads
- [ ] Auto-plays on screen
- [ ] Sound works
- [ ] Visual is smooth

### Controls:
- [ ] Center play button works
- [ ] Bottom play button works
- [ ] Progress bar fills
- [ ] Time updates
- [ ] Controls appear on tap
- [ ] Controls auto-hide

### UI:
- [ ] 16:9 aspect ratio
- [ ] Controls overlay visible
- [ ] Icons render correctly
- [ ] Text readable

### Cross-Platform:
- [ ] Works on Web
- [ ] Works on Expo Go
- [ ] Works on Android emulator
- [ ] Consistent behavior

---

## ✅ SUCCESS CRITERIA

If all these work, Stage 1 is **successful**:

1. ✅ Video plays in-app (not external browser)
2. ✅ Play/pause controls functional
3. ✅ Progress bar shows progress
4. ✅ Time display updates
5. ✅ No crashes or freezes
6. ✅ Works on all test platforms

---

## 📝 REPORT ISSUES

If you find bugs, note:
1. **Platform:** Web / Expo Go / Android
2. **Issue:** Description
3. **Console Errors:** Copy any red errors
4. **Steps to Reproduce:** How to trigger bug

---

## 🎉 WHEN READY FOR STAGE 2

If Stage 1 works perfectly and you want more features:

**Reply with:** "PROCEED TO STAGE 2"

**Stage 2 adds:**
- ✅ Seek functionality (tap progress bar to jump)
- ✅ Forward/Backward 10s buttons
- ✅ Playback speed (0.5x - 2x)
- ✅ Save progress to AsyncStorage
- ✅ Resume from last position
- ✅ Mark as completed
- ✅ Continue watching list

---

**Start testing now:**
```bash
npx expo start -c
```

**Good luck! 🚀**
