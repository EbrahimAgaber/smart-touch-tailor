import os
import glob
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import arabic_reshaper
from bidi.algorithm import get_display
from gtts import gTTS
import moviepy as mp

# Target resolution
WIDTH, HEIGHT = 1920, 1080
FPS = 24

UPLOAD_DIR = r"C:\Users\bin-g\.gemini\antigravity\brain\0d2956c0-7e6d-4b6f-ba08-783176a7193e\.user_uploaded"
OUTPUT_VIDEO = r"c:\my-pos\v2\marketing_video.mp4"
TEMP_DIR = r"c:\my-pos\v2\temp_media"
os.makedirs(TEMP_DIR, exist_ok=True)

# Images map
competitor_img = os.path.join(UPLOAD_DIR, "media__1784825769280.jpg")
dashboard_img = os.path.join(UPLOAD_DIR, "media__1784826092662.png")
pos_img = os.path.join(UPLOAD_DIR, "media__1784826202831.png")
smart_dash_img = os.path.join(UPLOAD_DIR, "media__1784826178611.png")
accounting_img = os.path.join(UPLOAD_DIR, "media__1784826285582.png")

scenes_data = [
    {
        "title_ar": "هل تعبت من الأنظمة المحاسبية المعقدة والقديمة؟",
        "sub_ar": "أنظمة تقليدية بطيئة وصعبة الاستخدام",
        "vo_text": "هل تعبت من الأنظمة المحاسبية المعقدة والقديمة التي تعطل عملك؟",
        "image": competitor_img,
        "bg_color": (30, 30, 40)
    },
    {
        "title_ar": "إليك الحل الأسهل والأذكى لنقاط البيع!",
        "sub_ar": "تصميم عصري - وسهولة فائقة لكل الموظفين",
        "vo_text": "إليك الحل الأسهل والأذكى! نظام نقاط البيع العصري المصمم للجميع بمرونة وسهولة فائقة.",
        "image": dashboard_img,
        "bg_color": (15, 23, 42)
    },
    {
        "title_ar": "واجهة مبيعات فائقة السرعة",
        "sub_ar": "كاشير ذكي بدون تعقيد تقني",
        "vo_text": "إدارة المبيعات بسرعة البرق، مع واجهة واضحة وبسيطة تلائم جميع الموظفين دون حاجة لخبرة تقنية.",
        "image": pos_img,
        "bg_color": (15, 23, 42)
    },
    {
        "title_ar": "ربط معتمد 100% مع هيئة الزكاة (ZATCA)",
        "sub_ar": "مؤتمت بالكامل مع لوحة تحليلات ذكية",
        "vo_text": "ربط فوري ومعتمد مع هيئة الزكاة والضريبة والدخل، مع لوحة تحليلات قيادية شاملة ومباشرة.",
        "image": smart_dash_img,
        "bg_color": (15, 23, 42)
    },
    {
        "title_ar": "مساعد ذكي AI ومركز محاسبي متكامل",
        "sub_ar": "استفسر بالذكاء الاصطناعي وتابع قوائمك المالية",
        "vo_text": "مساعد ذكي يعتمد على الذكاء الاصطناعي لإجابة استفساراتك فوراً، مع مركز مالي ومحاسبي دقيق.",
        "image": accounting_img,
        "bg_color": (15, 23, 42)
    },
    {
        "title_ar": "انقل عملك إلى المستقبل اليوم!",
        "sub_ar": "تواصل معنا فوراً لتجربة النظام",
        "vo_text": "انقل عملك إلى المستقبل اليوم. تواصل معنا عبر البريد الإلكتروني أو الواتساب الظاهر على الشاشة.",
        "image": None,
        "is_outro": True,
        "bg_color": (10, 15, 30)
    }
]

def format_arabic(text):
    reshaped_text = arabic_reshaper.reshape(text)
    bidi_text = get_display(reshaped_text)
    return bidi_text

def get_font(size):
    font_paths = [
        "C:\\Windows\\Fonts\\arial.ttf",
        "C:\\Windows\\Fonts\\tahoma.ttf",
        "C:\\Windows\\Fonts\\seguiemj.ttf",
        "C:\\Windows\\Fonts\\segoeui.ttf"
    ]
    for fp in font_paths:
        if os.path.exists(fp):
            try:
                return ImageFont.truetype(fp, size)
            except Exception:
                pass
    return ImageFont.load_default()

def create_card_frame(scene, progress=0.0):
    bg_color = scene.get("bg_color", (15, 23, 42))
    base_img = Image.new("RGB", (WIDTH, HEIGHT), color=bg_color)
    draw = ImageDraw.Draw(base_img)
    
    # Draw header banner
    draw.rectangle([0, 0, WIDTH, 120], fill=(2, 132, 199))
    
    font_title = get_font(44)
    font_sub = get_font(30)
    font_contact = get_font(38)
    
    title_text = format_arabic(scene["title_ar"])
    sub_text = format_arabic(scene["sub_ar"])
    
    # Title overlay
    draw.text((WIDTH // 2, 40), title_text, fill=(255, 255, 255), font=font_title, anchor="mm")
    draw.text((WIDTH // 2, 90), sub_text, fill=(224, 242, 254), font=font_sub, anchor="mm")
    
    if scene.get("is_outro"):
        # Dedicated outro card design
        draw.rectangle([200, 220, WIDTH - 200, HEIGHT - 150], fill=(30, 41, 59), outline=(56, 189, 248), width=3)
        
        email_txt = "Email: ea.gaber10@gmail.com"
        wa_txt = "WhatsApp: +966 53 317 4895"
        feat_txt = format_arabic("نظام نقاط البيع والربط مع الزكاة والذكاء الاصطناعي")
        
        draw.text((WIDTH // 2, 320), feat_txt, fill=(56, 189, 248), font=get_font(48), anchor="mm")
        draw.text((WIDTH // 2, 450), email_txt, fill=(255, 255, 255), font=font_contact, anchor="mm")
        draw.text((WIDTH // 2, 540), wa_txt, fill=(74, 222, 128), font=font_contact, anchor="mm")
        
        call_txt = format_arabic("تواصل معنا الآن واحصل على العرض الخاص")
        draw.text((WIDTH // 2, 680), call_txt, fill=(253, 224, 71), font=get_font(40), anchor="mm")
    else:
        # Load screen image
        img_path = scene["image"]
        if os.path.exists(img_path):
            content_img = Image.open(img_path).convert("RGB")
            
            # Subtle zoom effect
            zoom_factor = 1.0 + (progress * 0.05)
            w, h = content_img.size
            crop_w, crop_h = int(w / zoom_factor), int(h / zoom_factor)
            left = (w - crop_w) // 2
            top = (h - crop_h) // 2
            content_img = content_img.crop((left, top, left + crop_w, top + crop_h))
            
            # Fit inside container area
            max_w, max_h = 1600, 840
            content_img.thumbnail((max_w, max_h), Image.Resampling.LANCZOS)
            
            cw, ch = content_img.size
            cx = (WIDTH - cw) // 2
            cy = 150 + (HEIGHT - 170 - ch) // 2
            
            # Draw shadow container box
            draw.rectangle([cx - 10, cy - 10, cx + cw + 10, cy + ch + 10], fill=(51, 65, 85))
            base_img.paste(content_img, (cx, cy))
            
    # Bottom contact bar
    draw.rectangle([0, HEIGHT - 50, WIDTH, HEIGHT], fill=(15, 23, 42))
    footer_text = format_arabic("للإستفسار والطلب: ea.gaber10@gmail.com  |  واتساب: 966533174895+")
    draw.text((WIDTH // 2, HEIGHT - 25), footer_text, fill=(148, 163, 184), font=get_font(24), anchor="mm")
    
    return np.array(base_img)

def build_video():
    clips = []
    
    for idx, scene in enumerate(scenes_data):
        vo_file = os.path.join(TEMP_DIR, f"vo_{idx}.mp3")
        tts = gTTS(text=scene["vo_text"], lang="ar", slow=False)
        tts.save(vo_file)
        
        audio_clip = mp.AudioFileClip(vo_file)
        duration = audio_clip.duration + 1.2 # padding
        
        def make_frame(t, sc=scene, dur=duration):
            progress = t / dur
            return create_card_frame(sc, progress)
            
        clip = mp.VideoClip(make_frame, duration=duration)
        clip = clip.with_audio(audio_clip)
        clips.append(clip)
        
    final_clip = mp.concatenate_videoclips(clips, method="compose")
    final_clip.write_videofile(
        OUTPUT_VIDEO,
        fps=FPS,
        codec="libx264",
        audio_codec="aac",
        threads=4
    )
    print("FINISHED_SUCCESSFULLY")

if __name__ == "__main__":
    build_video()
