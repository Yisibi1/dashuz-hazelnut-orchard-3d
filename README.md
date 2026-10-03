# Şəki Daşüz — 84 Sot Müasir İntensiv Fındıq Bağı (Three.js 3D Planı)

Bu layihə Şəki rayonunun Daşüz kəndində yerləşən 0.8454 hektar (84.54 sot) torpaq sahəsi üçün xüsusi olaraq hazırlanmışdır. Kadastr planının dəqiq ölçülərinə (26.5 m x 320 m) və aqronomik qaydalara əsaslanan interaktiv 3D bağ simulyasiyasıdır.

## 🚀 Layihənin Əsas Xüsusiyyətləri
* **Three.js 3D İnteraktiv Mühit:** Azad fırlatma (Orbit), 2D Kadastr üstdən baxış və cərgələrarası gəzinti (Walkthrough) rejimləri.
* **Şahmat Tozlanma Sxemi:** 300 fındıq ağacından 268-i əsas sort (*Tonda di Giffoni*), 32-si isə şahmat qaydasında yerləşdirilmiş tozlayıcı sortlardır (*Nocchione* və *Mortarella*).
* **Müasir Damcı Suvarma Şəbəkəsi:** 5 cərgə boyu 16 mm damcı xətləri, filtrasiya və gübrələmə (Venturi) qovşağı, animasiyalı suvarma rejimi.
* **Torpaq & Subsidiya Statistikası:** EKTİS və AKİA subsidiyaları üçün hazırlanmış xülasə göstəricilər və interaktiv ağac məlumat kartı (inspektor).

---

## 📦 Vercel-ə Yükləmə (Deploy) Təlimatı

Layihə standart Vite konfiqurasiyasına malikdir və heç bir əlavə sazlama olmadan Vercel-də 1 saniyədə deploy olunur.

### 1-ci Üsul: GitHub və Vercel (Ən rahat və tövsiyə olunan)
1. Bu qovluqdakı dəyişiklikləri Git-ə commit edib GitHub-da yeni repozitoriyanıza göndərin (`push` edin):
   ```bash
   git add .
   git commit -m "Add 3D Hazelnut Orchard Plan"
   git branch -M main
   git remote add origin https://github.com/SİZİN_HESABINIZ/REPO_ADI.git
   git push -u origin main
   ```
2. [Vercel.com](https://vercel.com) saytına daxil olun.
3. **"Add New Project"** düyməsinə klikləyib GitHub repozitoriyanızı seçin.
4. **"Deploy"** düyməsini sıxın. Vercel layihəni avtomatik aşkar edib canlı linki (məsələn, `https://dashuz-orchard.vercel.app`) sizə təqdim edəcək.

---

### 2-ci Üsul: Vercel CLI ilə Birbaşa Terminaldan
Terminaldan dərhal yükləmək istəsəniz:
```bash
npx vercel
```
Vercel sizdən təsdiq istəyəcək və layihənizi birbaşa internetdə yayımlayacaq.

---

## 💻 Lokal Kompüterdə İşə Salmaq
Layihəni öz kompüterinizdə yoxlamaq üçün:
```bash
npm run dev
```
və ya
```bash
npx vite
```
Brauzerinizdə `http://localhost:5173` ünvanını açın.
