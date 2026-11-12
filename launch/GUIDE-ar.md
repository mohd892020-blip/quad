# دليل نشر Flying Parcel على جوجل بلاي

هاد الدليل بيمشي معك خطوة خطوة جوّا Play Console، من فتح الحساب لحد ما تطلع اللعبة للناس.
أسماء الحقول بتضل بالإنجليزي متل ما بتشوفها بالكونسول، والشرح بالعربي.

كل بند عليه علامة من تلاتة:
- **[جاهز]** يعني محضّر بهالمجلد، بس انسخ أو ارفع.
- **[عليك]** يعني لازم تعمله بإيدك (حساب، دفع، كبسة بالكونسول، قرار).
- **[معلّق]** يعني ناطر قرار أو شغل لسا ما خلص.

آخر تحقق من شروط جوجل: 2026-11-12. الروابط الرسمية بآخر الملف.

---

## الخلاصة بسرعة

اللي جاهز هلأ: نصوص المتجر بـ15 لغة (اسم، وصف قصير، وصف كامل، ملاحظة الإصدار)، وإجابات كل نماذج App content، وخطة الصور والفيديو، وقائمة الشغل التقني.

اللي معلّق: الأيقونة الرسمية (ناطرين اختيارك)، وبعدها صور الشاشة وصورة الواجهة، وتسجيل فيديو جديد، وبناء ملف AAB بدل APK، ورفع targetSdk لـ36، وتدوير مفتاح فايربيس.

اللي عليك: فتح حساب المطوّر والدفع والتوثيق، وتعبئة الكونسول، وجمع 12 مختبِر لمدة 14 يوم، ورفع الفيديو على يوتيوب.

أهم تنبيه: جوجل بلاي ما بتقبل ملف APK لتطبيق جديد، بدها AAB. وما بتقبل أي تطبيق جديد إلا إذا targetSdk تبعه 36 أو أكتر. التطبيق هلأ APK وعلى 34، فلازم هالخطوتين قبل أول رفع (شوف قسم «الجاهزية التقنية»).

---

## محتويات المجلد

- `launch/GUIDE-ar.md` هاد الملف.
- `launch/listing/<لغة>/` لكل لغة أربع ملفات: `title.txt` (الاسم)، `short_description.txt` (الوصف القصير)، `full_description.txt` (الوصف الكامل)، `release_notes.txt` (ملاحظة «What's new» لأول إصدار). نفس ترتيب أداة fastlane supply، فبتقدر ترفعهم بأداة كمان إذا حبيت.
- `launch/graphics/` الصور (معلّقة لحد اعتماد الأيقونة).
- `launch/video/` الفيديو (ملفات mp4 ما بتنرفع على جيت هب).

اللغات: en-US (الأساسية)، ar، es-419، es-ES، pt-BR، fr-FR، de-DE، it-IT، tr-TR، ru-RU، id، hi-IN، ja-JP، ko-KR، vi.

تنبيه للأمانة: واجهة اللعبة نفسها إنجليزي بس. كل وصف مترجم آخره سطر بيقول «لغة اللعبة: الإنجليزية»، عشان ما حدا يتفاجأ ويحط تقييم سيء.

---

## الخطوة 1: حساب المطوّر

**[عليك]** ادخل على play.google.com/console بحساب جوجل اللي بدك تضل تستعمله للأبد (ما بينتقل التطبيق بسهولة لحساب تاني).

**[عليك]** اختار نوع الحساب:
- **Personal** (شخصي): الأسهل. بس الحسابات الشخصية الجديدة لازم تعمل اختبار مغلق مع 12 مختبِر لمدة 14 يوم متواصلين قبل ما يسمحولك تنشر للعامة.
- **Organization** (شركة): بدها رقم D-U-N-S وشركة مسجّلة. ميزتها إنها معفية من شرط الـ12 مختبِر. إذا ZiMi Games شركة مسجّلة رسميًا فكّر فيها، وإذا لأ خليك على الشخصي.

**[عليك]** ادفع رسوم التسجيل (25 دولار مرة وحدة).

**[عليك]** وثّق الهوية: الاسم القانوني والعنوان وصورة هوية، ورقم التلفون والإيميل. التوثيق ممكن ياخد من يوم لكم يوم.

**[عليك]** الحسابات الشخصية الجديدة لازم توثّق إنه معك جوال أندرويد حقيقي: نزّل تطبيق Play Console على جوالك وفوت فيه بنفس الحساب. ومن 2026 في كمان «Android developer verification»، وأصحاب حسابات Play Console بيكمّلوها من جوّا الكونسول نفسه.

**[عليك]** Developer name (اسم المطوّر اللي بيطلع تحت اسم اللعبة بالمتجر): اقتراحي ZiMi Games، متل موقع صفحة الخصوصية.

---

## الخطوة 2: إنشاء التطبيق

**[عليك]** من الكونسول: Create app، وعبّي:
- App name: `Flying Parcel: Drone Delivery` (أو بس `Flying Parcel` إذا بدك الاسم قصير).
- Default language: English (United States) – en-US.
- App or game: **Game**.
- Free or paid: **Free**. تنبيه: بعد ما تختار Free ما بتقدر ترجعها مدفوعة أبدًا. هاد مناسب لأنه الدخل رح يكون من الإعلانات.
- علّم على موافقات Developer Program Policies وUS export laws، وكبس Create app.

**[جاهز]** معرّف التطبيق (package name) هو `com.flyingparcel.game`. بينحجز للأبد مع أول رفع، وما بيتغيّر بعدها.

---

## الخطوة 3: صفحة المتجر (Main store listing)

بالكونسول: Grow users ← Store presence ← Main store listing.

### النصوص

**[جاهز]** App name (حد 30 حرف): من `launch/listing/en-US/title.txt`.

**[جاهز]** Short description (حد 80 حرف): من `short_description.txt`.

**[جاهز]** Full description (حد 4000 حرف): من `full_description.txt`.

قواعد جوجل اللي التزمت فيها بكل اللغات: لا «best» ولا «#1» ولا «top» ولا «new» ولا «free»، ولا «download now» أو «play now»، ولا إيموجي بالوصف القصير، ولا كلمات كلها كابيتال بالوصف القصير، وما في أي ميزة مش موجودة فعلًا باللعبة.

### الترجمات

**[عليك]** تحت صفحة المتجر في Manage translations ← Add your own translations. علّم اللغات هدول، ولكل لغة الصق الملفات من مجلدها:
ar (Arabic)، es-419 (Spanish – Latin America)، es-ES (Spanish – Spain)، pt-BR (Portuguese – Brazil)، fr-FR (French – France)، de-DE (German)، it-IT (Italian)، tr-TR (Turkish)، ru-RU (Russian)، id (Indonesian)، hi-IN (Hindi)، ja-JP (Japanese)، ko-KR (Korean)، vi (Vietnamese).

نصيحة: إذا اللغة ما إلها صور خاصة، جوجل بتعرض الصور الإنجليزية. وهاد تمام لأنه اللعبة إنجليزي أصلًا.

### الصور

مواصفات جوجل الحالية:
- App icon: مربع 512×512، PNG بـ32 بت (مسموح الشفافية)، حجم أقل من 1 ميجا. بلا شارات أو نصوص متل «#1» أو سعر.
- Feature graphic: 1024×500، JPEG أو PNG بـ24 بت بلا شفافية. إلزامية.
- Phone screenshots: من 2 لـ8. الألعاب: جوجل بتنصح بـ3 على الأقل، عمودي 1080×1920 أو أفقي 1920×1080. كل ضلع بين 320 و3840 بكسل، والضلع الطويل ما بيزيد عن ضعف القصير. JPEG أو PNG بلا شفافية.
- 7-inch و10-inch tablet screenshots: 4 على الأقل لكل نوع حتى تنعرض اللعبة بقوائم التابلت، نسبة 16:9 أو 9:16، كل ضلع بين 1080 و7680.
- لكل صورة نص بديل (alt text) حده 140 حرف، وما يبلّش بـ«photo of» أو «image of».
- الكلام المكتوب فوق الصورة أقل من 20% منها، وبلا صور إيدين ماسكة جوال.

**[جاهز]** App icon: `launch/graphics/icon/icon-512.png` (الأيقونة رقم 1، صورة كوبتر توصيل حقيقية، مصدرها ورخصتها بـ`android/store/ICON-SOURCE.md`).

**[معلّق]** Feature graphic: بتنعمل بعد اعتماد الأيقونة عشان تمشي معها بالشكل والألوان. الفكرة: عنوان Flying Parcel بخط Lalezar، والكوبتر والطرد على الحبل فوق المدينة، بألوان اللعبة.

**[معلّق]** Screenshots: بتنعمل بعد الأيقونة كمان، من اللعبة الحقيقية. الخطة:
- 8 صور جوال عمودي 1080×1920، ونسخة أفقي 1920×1080.
- 4 لـ6 صور تابلت 7 إنش أفقي 1920×1080.
- 4 لـ6 صور تابلت 10 إنش أفقي 2560×1440.
- اللقطات: طيران والطرد على الحبل فوق المدينة، مكالمة زبون واردة، تسليم PERFECT مع القصاصات، خريطة المهمات، بطاقة النتيجة بالنجوم، Rush Hour، الشط مع العبّارة، الصحرا أو الثلج، المطر أو الليل، الحظيرة والمتجر بالطيارات.
- كل صورة بنسختين: نظيفة متل اللعبة، ونسخة بعنوان تسويقي صغير فوقها. انت بتختار شو ترفع.

### الفيديو

**[جاهز]** الشرط: رابط يوتيوب لفيديو واحد، Public أو Unlisted، مش Private، مش مقيّد بالعمر، الإعلانات عليه مطفية، والتضمين (embedding) مسموح. بلا رابط قائمة تشغيل وبلا وقت بالرابط.

**[معلّق]** الفيديوهات الموجودة بـ`promo/` على جهازك (store-action-30s-1080p وstore-howto-60s-1080p والريلز العمودية) انسجلت بـ2026-11-10 قبل تغيير الاسم. كلها بتبيّن عنوان **Flying Pizza**، والمكالمة القديمة اللي بترن لحد ما ترد عليها مع زر Answer وصوت المتصل، وكل هاد تغيّر: الاسم صار Flying Parcel، والمكالمة صارت ترد لحالها وبلا صوت كلام. لهيك ما نسختها هون وما بنصح ترفعها للمتجر.

اللقطات اللي بدها تسجيل من جديد:
- شاشة العنوان والنهاية (الاسم الجديد).
- كل لقطات «Ms. Tara is calling» و«Mr. Bill is calling» و«Mr. Fuaat is calling» مع الرد اليدوي وجملة المتصل.
- اللقطات اللي فيها الشريط العلوي القديم أو أيقونة التطبيق القديمة.

اللقطات اللي بتنفع تنعاد بنفس الفكرة: العبّارة المتحركة، العاصفة الرملية، النسور، الثلج والعاصفة والليل، Rush Hour، التسليم لقارب Seda.

**[عليك]** بعد ما يجهز الفيديو الجديد: يوتيوب ← Create ← Upload video، خليه Unlisted، وبـMonetization خليه Off، وبـAudience اختار «No, it's not made for kids» (اللعبة لـ13 وفوق)، وتأكد إنه Allow embedding مفعّل. انسخ الرابط بشكل `https://www.youtube.com/watch?v=...` والصقه بحقل Video بصفحة المتجر.

---

## الخطوة 4: إعدادات المتجر (Store settings)

بالكونسول: Grow users ← Store presence ← Store settings.

**[جاهز]** App category: **Game**، والتصنيف المقترح **Casual**. البديل **Simulation** إذا حابب تركّز على فيزياء الطيران.

**[جاهز]** Tags (لحد 5 من قايمة جوجل): اختار الأقرب من هدول: Casual، Flying، Physics، Delivery، Offline، Single player، Stylized. القايمة بتتغير، فاختار الموجود منهم.

**[عليك]** Contact details:
- Email (إلزامي وبيبيّن للعامة): `<<CONTACT_EMAIL>>`، حط إيميل الدعم نفسه اللي بصفحة الخصوصية عشان يتطابقوا.
- Phone (اختياري): اتركه فاضي.
- Website: `https://zimigames.com/games/flying-parcel`

**[عليك]** External marketing: خليه مفعّل، بيسمح لجوجل تعرض اللعبة برّا المتجر.

---

## الخطوة 5: محتوى التطبيق (App content / Policy)

بالكونسول: Policy and programs ← App content. كل بند لازم يصير عليه علامة خضرا.

### Privacy policy

**[جاهز]** `https://zimigames.com/games/flying-parcel/privacy`

قريت الصفحة اليوم. اللي فيها متطابق مع اللعبة: ما في حساب، والتقدّم محفوظ على الجهاز، والهاي سكور بيبعت الاسم المستعار والنتيجة ورقم لاعب عشوائي من فايربيس، وحذف النتيجة بيصير بإيميل.

**[معلّق]** نقطتين بصفحة الخصوصية لازم تنتبه إلهم:
- الصفحة بتحكي عن AdMob وإعلانات، والتطبيق هلأ ما فيه أي إعلانات حقيقية. هاد مقبول كتحضير، بس لازم نموذج Ads ونموذج Data safety يحكوا الحقيقة الحالية (بلا إعلانات)، ولما تنضاف AdMob بتحدّثهم.
- الصفحة بتقول إنه لاعبين أوروبا بيقدروا يغيّروا موافقة الإعلانات من إعدادات الخصوصية جوّا اللعبة، وهالإعداد لسا مش موجود. بينضاف مع AdMob (نموذج موافقة UMP).

### App access

**[جاهز]** اختار: **All functionality in my app is available without any access restrictions**. ما في تسجيل دخول ولا كلمة سر. (وضع المطور مخفي وما بيلزم المراجع.)

### Ads

**[جاهز]** اختار: **No, my app does not contain ads**. صحيح هلأ: كرت الإعلان باللعبة تجريبي وبس بوضع المطور.

**[معلّق]** لما تنضاف AdMob لازم ترجع تغيّرها لـYes قبل ما ترفع النسخة اللي فيها إعلانات.

### Content rating (استبيان IARC)

**[عليك]** عبّي الاستبيان بإيميلك، والفئة **Game**. الإجابات المقترحة (جاوب حسب الحقيقة إذا شي تغيّر):
- Violence (عنف): **No**. ما في أي شخص أو حيوان بيتأذى. الصقور والنسور بيلاحقوا الطيارة، والطيارة ممكن تنفجر لما تتحطم، بس ما في دم ولا أذى لكائن حي. إذا طلع سؤال عن «fantasy or cartoon violence» على أشياء غير حية بس، جاوب بصراحة إنه في تحطّم للطيارة.
- Fear / Horror (رعب): **No**.
- Sexuality (جنس) وNudity (عري): **No**.
- Language (ألفاظ نابية): **No**. وأسماء الهاي سكور عليها فلتر شتائم.
- Controlled substances (مخدرات وكحول ودخان): **No**.
- Crude humor: **No**.
- Gambling (قمار أو صناديق حظ): **No**. تقويم الهدايا اليومي مبالغ ثابتة مش حظ.
- Users interact / share content (تفاعل المستخدمين): **Yes**، لأنه الاسم المستعار اللي بيختاره اللاعب بيبيّن للكل بلوحة الهاي سكور. ما في دردشة ولا رسائل. هالجواب ما بيرفع التقييم، بس بيضيف ملاحظة «Users Interact».
- Shares location: **No**.
- Digital purchases (شراء بمصاري حقيقية): **No**. المتجر جوّا اللعبة بمصاري اللعبة بس.
- Unrestricted internet / web browser: **No**.

التقييم المتوقع: PEGI 3، وESRB Everyone، وUSK 0، أو قريب منهم.

### Target audience and content

**[جاهز]** Target age: **13–15** و**16–17** و**18+**. ما تختار أي فئة تحت 13، لأنه هيك بتدخل سياسة Families بشروط إعلانات أقسى، وصفحة الخصوصية بتقول إنه اللعبة مش موجّهة لتحت 13.

**[جاهز]** سؤال «Could your app unintentionally appeal to children?»: اللعبة كرتونية وملوّنة، فممكن جوجل تعتبرها جذابة للأطفال. جاوب بصراحة. إذا سألوا، الرد إنه التصميم مش موجّه للأطفال، والصفحة والوصف ما فيهم شخصيات أطفال، والمهمات بتعتمد على مهارة وتوقيت. إذا جوجل أصرّت، بيتطلب منك تطبّق شروط Families، وهاد بيأثر على الإعلانات بعدين.

### Data safety

**[جاهز]** هاي الإجابات مبنية على اللي اللعبة بتبعته فعلًا: بس لوحة الهاي سكور جوّا تطبيق الأندرويد، عبر فايربيس (Authentication مجهول وFirestore) باتصال HTTPS.

Data collection and security:
- Does your app collect or share any of the required user data types? **Yes**.
- Is all of the user data collected by your app encrypted in transit? **Yes**.
- Do you provide a way for users to request that their data is deleted? **Yes** (بإيميل حسب صفحة الخصوصية).
- Account creation: **My app does not allow users to create an account**. الانضمام للوحة باسم مستعار بلا إيميل ولا كلمة سر، وصفحة الخصوصية بتقول «ما في حساب».

Data types (علّم هدول بس):
- Personal info ← **Name**: الاسم المستعار. Collected: Yes، Shared: No، Processed ephemerally: No، Required or optional: **Optional** (اللاعب بيختار ينضم)، Purpose: **App functionality**.
- Personal info ← **User IDs**: رقم اللاعب العشوائي من فايربيس. Collected: Yes، Shared: No، Optional، Purpose: **App functionality**.
- App activity ← **Other actions**: نتيجة اللعب. Collected: Yes، Shared: No، Optional، Purpose: **App functionality**.

ما بتعلّم: الموقع، الإيميل، الصور، جهات الاتصال، معرّف الإعلانات، معلومات الجهاز. تنبيه للأمانة: فايربيس بيشوف عنوان IP وقت الدخول لحماية من الإساءة، وهاد ما بيستعمل لمعرفة موقع اللاعب، ولهيك ما علّمت Approximate location.

«Shared: No» صح لأنه فايربيس مزوّد خدمة بيشتغل عنك، وجوجل ما بتعدّ هاد مشاركة.

**[معلّق]** لما تنضاف AdMob، النموذج بيتغيّر: Device or other IDs، وApp interactions، وDiagnostics، وShared مع AdMob للإعلانات، وبتحتاج إذن AD_ID.

### Advertising ID

**[جاهز]** Does your app use advertising ID? **No**. التطبيق ما فيه إذن AD_ID ولا مكتبة إعلانات. بيتغيّر لـYes مع AdMob.

### باقي التصاريح

**[جاهز]** جاوب على هدول كلهم بالنفي:
- Government apps: **No**، مش تطبيق حكومي.
- Financial features: **My app doesn't provide any financial features**.
- Health apps: **My app does not have any health features**.
- News apps: **No**، مش تطبيق أخبار.
- COVID-19 contact tracing and status apps: **My app is not a publicly available COVID-19 contact tracing or status app**.
- إذا طلعلك أي تصريح عن أذونات حساسة (موقع، صور، خدمة بالخلفية)، التطبيق ما بيطلب أي منها، فالجواب لأ.

---

## الخطوة 6: الدول والسعر

**[جاهز]** Pricing: **Free**.

**[عليك]** Countries / regions: اقتراحي كل الدول (Add countries ← All). بتقدر تشيل دولة إذا في سبب.

ملاحظة: كل مسار اختبار (Internal وClosed) إله اختيار دول خاص فيه، فلازم تختار الدول لكل مسار.

---

## الخطوة 7: مسارات الإصدار

### Internal testing (اختبار داخلي سريع)

**[عليك]** Testing ← Internal testing ← Create new release. حط حالك وكم حدا قريب (لحد 100 بالإيميل). بيوصل خلال دقايق وبلا مراجعة طويلة. هون بتتأكد إنه الـAAB بينزل وبيشتغل من المتجر.

**[عليك]** أول مرة بيسألك عن Play App Signing: وافق إنه **جوجل تولّد وتحفظ مفتاح توقيع التطبيق**. مفتاحك بـ`~/.flying-pizza/flying-pizza.keystore` بيصير **upload key** بس (المفتاح اللي بتوقّع فيه الملف قبل الرفع).

تنبيه مهم للمختبِرين: النسخة اللي من المتجر موقّعة بمفتاح جوجل، فما بتنزل فوق الـAPK اللي بعتّلهم ياه قبل. لازم يمسحوا القديمة أول، وهيك بيروح تقدّمهم المحفوظ على الجهاز.

### Closed testing (الاختبار المغلق، شرط الـ12)

**[عليك]** شرط الحساب الشخصي الجديد (من جوجل نفسها، آخر تحقق اليوم): لازم **12 مختبِر على الأقل** يضلوا مشتركين **14 يوم متواصلين** قبل ما تطلب النشر للعامة. اللي بيطلع قبل 14 يوم ما بينحسب، وإذا طلع ورجع بيبلّش العد من جديد. ومن الأفضل يكون عندك أكتر من 12 احتياط (مثلًا 15 لـ20).

الطريقة:
- Testing ← Closed testing ← Create track (أو استعمل Alpha الجاهز).
- Testers: اعمل Google Group (أسهل) أو قايمة إيميلات، وحط فيها المختبِرين. كل واحد لازم يكون عنده جوال أندرويد وحساب جوجل.
- ارفع نفس الـAAB، وخلّي الدول نفسها.
- ابعت لكل مختبِر **رابط الاشتراك (opt-in link)**. لازم يفتحه ويكبس «Become a tester» وبعدين ينزّل اللعبة من جوجل بلاي.
- اعطيهم طريقة يبعتولك ملاحظات (إيميل أو مجموعة)، وشجّعهم يجرّبوا كل شي: المهمات، Rush Hour، مهمة اليوم، المتجر، الهاي سكور، عمودي وأفقي.
- احفظ ملاحظاتهم واللي صلّحته، لأنه جوجل رح تسألك عنهم.
- رفع تحديثات خلال الاختبار شي طبيعي ومطلوب، المهم يضل المختبِرين مشتركين.

### Apply for production (طلب النشر)

**[عليك]** بعد الـ14 يوم: Dashboard ← Apply for production. جوجل بتسأل أسئلة. مسودات أجوبة بالإنجليزي، عدّلها حسب اللي صار فعلًا:

- How easy was it to recruit testers? جاوب بصراحة.
- Did testers use all features? «Testers played the story missions, Rush Hour, the daily mission, the shop and the online High Score board, in portrait and landscape.»
- Feedback summary: اكتب أهم 3 لـ5 ملاحظات وصلتك، وكيف وصلتك (إيميل أو مجموعة).
- Who is your target audience? «Players aged 13 and up who enjoy casual physics and flying games on Android phones and tablets.»
- What makes your game unique? «You fly a delivery drone with the order hanging on a rope, so every delivery is a physics puzzle: swing, wind, weight and fragility, across 80 handcrafted missions in six regions, with named customers who call in each order.»
- Expected installs in the first year: اختار رقم واقعي (مثلًا 1,000 – 10,000).
- What changes did you make based on testing? عدّد اللي صلّحته.
- How did you decide it is ready? «All testers completed the training and early missions without crashes on their devices, the pre-launch report showed no crashes, and the reported issues were fixed.»

المراجعة عادةً 7 أيام أو أقل.

### Production (النشر للعامة)

**[عليك]** بعد الموافقة: Production ← Create new release ← ارفع الـAAB، والصق ملاحظة الإصدار لكل لغة من `release_notes.txt` (حدها 500 حرف)، وراجع وابعت للمراجعة. بتقدر تبلّش بـStaged rollout (مثلًا 20%) وتزيدها بعدين.

**[عليك]** شوف **Pre-launch report** بعد كل رفع: جوجل بتجرّب اللعبة على أجهزة حقيقية وبتطلّع أعطال وصور.

---

## الجاهزية التقنية (فحص الكود، بلا ما غيّرت شي)

### الصيغة: AAB مش APK

**[معلّق]** جوجل بلاي بتطلب Android App Bundle (ملف .aab) لكل تطبيق جديد من 2021. `npm run apk` (`scripts/build-apk.js`) بيطلّع APK بس.

**[معلّق، بدها موافقتك]** الاقتراح: سكربت بناء جديد `npm run aab` جنب القديم، بنفس الأدوات بلا Gradle:
- aapt2 link بخيار `--proto-format` بدل الصيغة العادية.
- ترتيب الملفات بمجلد base: `manifest/AndroidManifest.xml`، `dex/classes.dex`، `res/`، `resources.pb`، `assets/`.
- أداة bundletool من جوجل (ملف jar مجاني) بتعمل منهم `flying-parcel.aab`.
- توقيعه بمفتاح الرفع نفسه بأداة jarsigner من الـJDK الموجود.
- bundletool بيقدر يطلّع APK من الـAAB للتجربة على جوالك قبل الرفع.
- الـAAB متل الـAPK فيه مفتاح فايربيس، فبيضل على الجهاز وما بينرفع على جيت هب (لازم نضيف `*.aab` للـ.gitignore).
- `npm run apk` بيضل متل ما هو للتجارب السريعة.

### targetSdk

**[معلّق]** من 31 آب 2026، أي تطبيق جديد أو تحديث لازم يستهدف **Android 16 (API 36)** أو أكتر. البناء هلأ `TARGET_SDK = '34'`، والأدوات بـ`~/.flying-pizza` فيها platform android-34 وbuild-tools 34 بس. بدنا ننزّل android-36 وbuild-tools 36.

لما نرفعه لـ36 في تغييرات بالأندرويد لازم تنفحص:
- **زر الرجوع**: بأندرويد 16 مع target 36، الرجوع التنبؤي (predictive back) بيصير تلقائي، والدالة `onBackPressed` اللي بـ`MainActivity.java` ما عادت تنادى. يعني زر الرجوع ممكن يطلّع من اللعبة فورًا بدل ما يرجع شاشة. الحل يا إما سطر `android:enableOnBackInvokedCallback="false"` بالمانيفست، أو نستعمل `OnBackInvokedCallback`. لازم ينفحص على جوال أندرويد 16.
- **الشاشة الكاملة (edge-to-edge)**: صارت إجبارية من target 35. اللعبة أصلًا شاشة كاملة، بس لازم نتأكد إنه ولا زر بيروح تحت النوتش أو شريط التنقل.
- **التابلت**: بأندرويد 16 على الشاشات الكبيرة النظام بيتجاهل قفل الاتجاه، فزر Play sideways ممكن ما يقفل الشاشة على التابلت. اللعبة بتشتغل بالاتجاهين فما في مشكلة كبيرة.

### الإصدار ورقمه

**[جاهز]** versionCode بيتحسب من عدد الحفظات بجيت (هلأ 129)، فبيزيد لحاله مع كل حفظة. جوجل بتطلب إنه يزيد مع كل رفع، فما تعمل build من نسخة أقدم.

**[معلّق، قرارك]** versionName هلأ `0.1.0.129` من package.json. اقتراحي ترفعه لـ`1.0.0` لأول إصدار عام.

### التوقيع

**[جاهز]** مفتاح التوقيع بـ`~/.flying-pizza/flying-pizza.keystore` وكلمة سره بـ`~/.flying-pizza/secrets.json`، وما في شي منهم بالمستودع.

**[عليك]** اعمل نسخة احتياطية من المجلد `~/.flying-pizza` كله (المفتاح وsecrets.json) بمكانين آمنين (مثلًا فلاشة ومكان مشفّر). مع Play App Signing، إذا ضاع مفتاح الرفع بتقدر تطلب تبديله من جوجل، بس بياخد وقت.

### الأذونات والمعمارية

**[جاهز]** الأذونات: INTERNET (للوحة الهاي سكور بس) وVIBRATE. الاتنين عاديين وما بيحتاجوا تصريح خاص بالكونسول.

**[جاهز]** 64 بت وصفحات 16 كيلو: التطبيق ما فيه أي مكتبات native، فما في مشكلة.

**[جاهز]** سياسة تطبيقات WebView: اللعبة كلها جوّا التطبيق ومش مجرد عرض لموقع، فما بتنطبق عليها قاعدة «webview spam».

### مفتاح فايربيس

**[جاهز]** المفتاح مقيّد على 3 خدمات بس: Identity Toolkit API وToken Service API وCloud Firestore API.

**[معلّق]** تدوير المفتاح: المفتاح القديم لسا موجود بتاريخ جيت (بالـAPK القديمة اللي انرفعت). بعد ما تعمل مفتاح جديد وتحطه بـsecrets.json وتبني، احذف القديم من جوجل كلاود.

**[معلّق، تذكير]** إذا بدك تقيّد المفتاح على تطبيق الأندرويد بس (Application restrictions ← Android apps)، لازم تضيف بصمة SHA-1 تبع **App signing key من جوجل** (من Play Console ← Test and release ← App integrity) وكمان بصمة مفتاح الرفع، وإلا اللوحة بتوقف بالنسخة اللي من المتجر. بس إذا في نسخة ويب بتستعمل نفس المفتاح، خليها None.

**[معلّق، اقتراح]** اللوحة بتقبل النتيجة اللي بتبعتها اللعبة، فاللي بيعدّل التطبيق ممكن يبعت رقم أعلى لحد السقف. الحماية الأقوى بتكون بـFirebase App Check مع Play Integrity بعد النشر.

---

## قرارات وشغل لسا معلّق

- **[معلّق]** الأيقونة الرسمية: ناطرين اختيارك، وبعدها صورة الواجهة والصور والفيديو.
- **[معلّق، بدها موافقتك]** بناء AAB (`npm run aab`).
- **[معلّق]** رفع targetSdk لـ36 مع فحص زر الرجوع والشاشة الكاملة.
- **[معلّق]** تدوير مفتاح فايربيس.
- **[معلّق، قرارك]** الطيارات بالمتجر: بالمصاري بس متل هلأ، أو كمان بإعلان مكافأة.
- **[معلّق]** الإعلانات الحقيقية (AdMob) مش مركّبة. كل عروض الإعلان (Skip Mission وAuto Land وAuto Drop) هلأ بوضع المطور بس. لما تنضاف: نموذج Ads بيصير Yes، وData safety بيتغيّر، وإذن AD_ID، ونموذج موافقة لأوروبا.
- **[معلّق، قرارك]** versionName ‏1.0.0.
- **[عليك]** إيميل التواصل مكان `<<CONTACT_EMAIL>>`.
- **[عليك]** تسجيل الفيديو الجديد ورفعه على يوتيوب.

---

## ترتيب مقترح للأيام الجاية

- اليوم: افتح حساب المطوّر وادفع وابدأ التوثيق (بياخد أيام، فبلّش فيه أول).
- خلال التوثيق: نعتمد الأيقونة، ونعمل الصور والفيديو، ونجهّز AAB وtargetSdk 36، وندوّر مفتاح فايربيس.
- بعدها: أنشئ التطبيق، وعبّي صفحة المتجر وApp content من هالدليل، وارفع على Internal testing وجرّب.
- بعدها: Closed testing مع 15 لـ20 مختبِر، وعدّ 14 يوم.
- بعدها: Apply for production، وبعد الموافقة Production.

---

## المصادر الرسمية

- مواصفات الصور والفيديو: https://support.google.com/googleplay/android-developer/answer/9866151
- شرط targetSdk: https://developer.android.com/google/play/requirements/target-sdk
- شرط الاختبار للحسابات الشخصية الجديدة: https://support.google.com/googleplay/android-developer/answer/14151465
- توثيق الجهاز للحسابات الجديدة: https://support.google.com/googleplay/android-developer/answer/14316361
- بيانات فايربيس لنموذج Data safety: https://firebase.google.com/docs/android/play-data-disclosure
- صيغة AAB: https://developer.android.com/guide/app-bundle
