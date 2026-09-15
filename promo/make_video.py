import os
import moviepy.editor as mp

# Ensure working directory is correct
os.chdir(r"C:\my-pos\v2\promo")

images = [
    "promo_1.png",
    "promo_2.png",
    "promo_3.png",
    "promo_4.png"
]

clips = []
for idx, img_path in enumerate(images):
    # Load image, set duration to 4 seconds
    clip = mp.ImageClip(img_path).set_duration(4)
    
    # Optional: apply a slight zoom effect for high quality feel
    # A simple crossfade is easier and very effective for standard moviepy
    if idx > 0:
        clip = clip.crossfadein(1)
        
    clips.append(clip)

# Concatenate with crossfades
final_clip = mp.concatenate_videoclips(clips, padding=-1, method="compose")

# Write output
output_file = "high_quality_promo.mp4"
final_clip.write_videofile(
    output_file,
    fps=24,
    codec="libx264"
)
print(f"Success! Video saved to {output_file}")
