@echo off
echo.
echo ============================================
echo  البصمة الذكية -- Smart Touch POS
echo  Rendering 60s Story Promo MP4
echo ============================================
echo.
echo [1/2] Building Remotion bundle...
call npx remotion render PromoVideo out/promo_story.mp4 ^
  --codec=h264 ^
  --crf=18 ^
  --frames=0-1799 ^
  --concurrency=4 ^
  --log=verbose
echo.
echo [2/2] Done! Check: new_promo\out\promo_story.mp4
pause
