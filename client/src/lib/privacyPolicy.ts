import type { Language } from "./i18n";

/**
 * Single source of truth for the privacy policy. The in-game page renders this
 * in the player's language, and `script/sync-privacy.ts` generates
 * PRIVACY_POLICY.md (and CI verifies the two never drift apart).
 *
 * Keep every statement here in sync with what the code actually does: portal
 * SDKs, opt-in diagnostics, online rankings and Google sign-in are all real.
 */

export interface PolicySection {
  heading: string;
  body: string;
}

export interface PolicyDoc {
  title: string;
  updated: string;
  intro: string;
  sections: PolicySection[];
  contact: string;
}

export const PRIVACY_UPDATED = "4 November 2026";

export const policyDocs: Record<Language, PolicyDoc> = {
  en: {
    title: "Privacy Policy",
    updated: `Last updated: ${PRIVACY_UPDATED}`,
    intro: "Neon Path Puzzle is playable offline and does not collect personal data by default. Nothing leaves your device until you explicitly turn on one of the optional features below.",
    sections: [
      {
        heading: "Stored on your device",
        body: "Level progress, records, settings, achievements, power-ups, themes, your anonymous local player id and (if you enable diagnostics) a capped local event log. Clearing app or browser storage removes them. Use Settings → Export save to keep a copy.",
      },
      {
        heading: "Circuit Lab and ghost links",
        body: "Boards you draw in the Circuit Lab and ghost challenges are encoded entirely inside the link's URL fragment: grid, start, nodes, drawn line and time. A URL fragment is never sent to a server, so these puzzles work offline and need no account. Small local flags remember which daily reveal, boss briefing and install prompt you have already seen; they contain no personal data. The diagnostics page lets you read, export or erase the local event log.",
      },
      {
        heading: "Optional online rankings and duels",
        body: 'Off until you tap "Join online play". A Cloudflare Worker operated by nRn World then receives a generated public name, a random player id created on your device, your star total, the times and drawn lines of daily, weekly and duel runs (the line only verifies the result), and duel rating and win/loss counts. Opponents see only the generated name and rating. No real name, email, location, device id or advertising id is sent. Stop anytime with "Stop sharing and go offline".',
      },
      {
        heading: "Optional Google sign-in",
        body: "Signing in lets your ranking follow you between devices. Google confirms only that the sign-in is genuine and provides a stable account number, which the server turns into a one-way hashed player id. Your name, email and profile picture are not read or stored, and the account is never used for advertising.",
      },
      {
        heading: "Optional diagnostics",
        body: 'Off until you enable "Help improve the game" in Settings. Only aggregate counters (event name, level number and date) are recorded, without a player or session id. They stay on your device and are exported only if you ask for the diagnostics file, or sent to the same worker as nameless counters when online play is also enabled. They are never used for advertising.',
      },
      {
        heading: "Portal builds, ads and permissions",
        body: "The plain web/PWA/Android build loads no third-party script. Builds made for Playgama or CrazyGames load that portal's SDK, and Playgama builds may show an interstitial after a level clear — only if you consent in Settings, at most once every five clears and with a three-minute gap. The game may use vibration for optional haptic feedback. There are no purchases and no third-party tracking in the standard build.",
      },
      {
        heading: "Children's privacy and deletion",
        body: "The game does not knowingly collect personal data from children. You can stop sharing at any time and ask for your ranking entries to be deleted by email.",
      },
    ],
    contact: "Questions may be sent to bynrnworld@gmail.com.",
  },
  sv: {
    title: "Integritetspolicy",
    updated: `Senast uppdaterad: ${PRIVACY_UPDATED}`,
    intro: "Neon Path Puzzle fungerar offline och samlar inte in personuppgifter som standard. Ingenting lämnar din enhet förrän du uttryckligen aktiverar en av de frivilliga funktionerna nedan.",
    sections: [
      {
        heading: "Sparas på din enhet",
        body: "Nivåframsteg, rekord, inställningar, prestationer, power-ups, teman, ditt anonyma lokala spelar-id och (om du aktiverar diagnostik) en begränsad lokal händelselogg. Att rensa appens eller webbläsarens lagring tar bort dem. Använd Inställningar → Exportera sparfil för att spara en kopia.",
      },
      {
        heading: "Kretslabb och spöklänkar",
        body: "Bräden du ritar i Kretslabbet och spökutmaningar kodas helt i länkens URL-fragment: rutnät, start, noder, dragen linje och tid. Ett URL-fragment skickas aldrig till en server, så puzzlen fungerar offline och kräver inget konto. Små lokala flaggor minns vilka dagliga avslöjanden, bossbriefingar och installationsförfrågningar du redan sett; de innehåller inga personuppgifter. Diagnostiksidan låter dig läsa, exportera eller radera den lokala händelseloggen.",
      },
      {
        heading: "Frivilliga online-rankinger och dueller",
        body: 'Avstängt tills du trycker på "Delta i onlinespel". En Cloudflare Worker som drivs av nRn World tar då emot ett genererat offentligt namn, ett slumpmässigt spelar-id som skapas på enheten, din stjärnsumma, tider och dragna linjer för dagliga, veckovisa och duellkörningar (linjen används bara för att verifiera resultatet) samt duellrating och vinster/förluster. Motståndare ser bara det genererade namnet och ratingen. Inget riktigt namn, e-post, plats, enhets-id eller annons-id skickas. Avsluta när som helst med "Sluta dela och gå offline".',
      },
      {
        heading: "Frivillig Google-inloggning",
        body: "Inloggning låter rankingen följa med mellan enheter. Google bekräftar bara att inloggningen är äkta och lämnar ett stabilt kontonummer som servern gör om till ett envägs hashat spelar-id. Ditt namn, din e-post och din profilbild läses eller sparas inte, och kontot används aldrig för annonser.",
      },
      {
        heading: "Frivillig diagnostik",
        body: 'Avstängt tills du aktiverar "Hjälp oss förbättra spelet" i Inställningar. Endast aggregerade räknare (händelsenamn, nivånummer och datum) sparas, utan spelar- eller sessions-id. De stannar på enheten och exporteras bara om du begär diagnostikfilen, eller skickas till samma worker som anonyma räknare när onlinespel också är aktiverat. De används aldrig för annonser.',
      },
      {
        heading: "Portalbyggen, annonser och behörigheter",
        body: "Det vanliga webb-/PWA-/Android-bygget laddar inget skript från tredje part. Byggen för Playgama eller CrazyGames laddar respektive portals SDK, och Playgama-byggen kan visa en annons efter en klarad nivå — bara om du samtycker i Inställningar, högst en gång per fem klarade nivåer och med tre minuters mellanrum. Spelet kan använda vibration för frivillig haptisk återkoppling. Det finns inga köp och ingen spårning från tredje part i standardbygget.",
      },
      {
        heading: "Barns integritet och radering",
        body: "Spelet samlar inte medvetet in personuppgifter från barn. Du kan när som helst sluta dela och begära att dina rankingposter raderas via e-post.",
      },
    ],
    contact: "Frågor kan skickas till bynrnworld@gmail.com.",
  },
  tr: {
    title: "Gizlilik Politikası",
    updated: `Son güncelleme: ${PRIVACY_UPDATED}`,
    intro: "Neon Path Puzzle çevrimdışı oynanabilir ve varsayılan olarak kişisel veri toplamaz. Aşağıdaki isteğe bağlı özelliklerden birini açmadan hiçbir veri cihazınızdan çıkmaz.",
    sections: [
      {
        heading: "Cihazınızda saklananlar",
        body: "Seviye ilerlemesi, rekorlar, ayarlar, başarımlar, güçlendirmeler, temalar, anonim yerel oyuncu kimliği ve (tanılamayı açarsanız) sınırlı bir yerel olay günlüğü. Uygulama veya tarayıcı deposunu temizlemek bunları siler. Ayarlar → Kaydı dışa aktar ile bir kopya alabilirsiniz.",
      },
      {
        heading: "Devre Laboratuvarı ve hayalet bağlantıları",
        body: "Devre Laboratuvarı'nda çizdiğin tahtalar ve hayalet mücadeleleri tamamen bağlantının URL parçasına kodlanır: ızgara, başlangıç, düğümler, çizilen çizgi ve süre. URL parçası hiçbir zaman sunucuya gönderilmez; bu bulmacalar çevrimdışı çalışır ve hesap gerektirmez. Küçük yerel bayraklar hangi günlük açılışı, boss brifingini ve yükleme önerisini gördüğünü hatırlar; kişisel veri içermez. Tanılama sayfası yerel olay günlüğünü okumanı, dışa aktarmanı veya silmeni sağlar.",
      },
      {
        heading: "İsteğe bağlı çevrimiçi sıralamalar ve düellolar",
        body: '"Çevrimiçi oyuna katıl" seçeneğine dokunana kadar kapalıdır. Ardından nRn World tarafından işletilen bir Cloudflare Worker; üretilen herkese açık adı, cihazda oluşturulan rastgele oyuncu kimliğini, yıldız toplamınızı, günlük/haftalık/düello sürelerini ve çizilen çizgileri (çizgi yalnızca sonucu doğrulamak için kullanılır) ve düello puanınızı alır. Rakipler yalnızca üretilen adı ve puanı görür. Gerçek ad, e-posta, konum, cihaz kimliği veya reklam kimliği gönderilmez.',
      },
      {
        heading: "İsteğe bağlı Google ile giriş",
        body: "Giriş yapmak sıralamanızın cihazlar arasında taşınmasını sağlar. Google yalnızca girişin gerçek olduğunu doğrular ve sunucunun tek yönlü hashlediği kalıcı bir hesap numarası verir. Adınız, e-postanız ve profil resminiz okunmaz veya saklanmaz; hesap reklam için kullanılmaz.",
      },
      {
        heading: "İsteğe bağlı tanılama",
        body: 'Ayarlarda "Oyunu geliştirmemize yardım et" açılana kadar kapalıdır. Yalnızca toplu sayaçlar (olay adı, seviye numarası ve tarih), oyuncu veya oturum kimliği olmadan kaydedilir. Bunlar cihazınızda kalır; yalnızca tanılama dosyasını isterseniz dışa aktarılır veya çevrimiçi oyun da açıksa adsız sayaç olarak aynı workere gönderilir. Reklam için kullanılmaz.',
      },
      {
        heading: "Portal sürümleri, reklamlar ve izinler",
        body: "Normal web/PWA/Android sürümü üçüncü taraf betiği yüklemez. Playgama veya CrazyGames için hazırlanan sürümler ilgili portalın SDK'sını yükler; Playgama sürümleri bir seviye tamamlandıktan sonra yalnızca Ayarlar'da onay verdiyseniz, en fazla her beş seviyede bir ve üç dakika arayla geçiş reklamı gösterebilir. Oyun isteğe bağlı titreşim kullanabilir. Standart sürümde satın alma veya üçüncü taraf izleme yoktur.",
      },
      {
        heading: "Çocukların gizliliği ve silme",
        body: "Oyun çocuklardan bilerek kişisel veri toplamaz. Paylaşımı istediğiniz zaman durdurabilir ve sıralama kayıtlarınızın silinmesini e-posta ile isteyebilirsiniz.",
      },
    ],
    contact: "Sorular bynrnworld@gmail.com adresine gönderilebilir.",
  },
  es: {
    title: "Política de privacidad",
    updated: `Última actualización: ${PRIVACY_UPDATED}`,
    intro: "Neon Path Puzzle se puede jugar sin conexión y no recopila datos personales por defecto. Nada sale de tu dispositivo hasta que activas expresamente una de las funciones opcionales siguientes.",
    sections: [
      {
        heading: "Almacenado en tu dispositivo",
        body: "Progreso de niveles, récords, ajustes, logros, mejoras, temas, tu identificador local anónimo y (si activas el diagnóstico) un registro local limitado de eventos. Borrar los datos de la app o del navegador los elimina. Usa Ajustes → Exportar partida para guardar una copia.",
      },
      {
        heading: "Laboratorio de circuitos y enlaces fantasma",
        body: "Los tableros que dibujas en el Laboratorio de circuitos y los retos fantasma se codifican por completo en el fragmento de la URL: cuadrícula, inicio, nodos, línea trazada y tiempo. Un fragmento de URL nunca se envía a un servidor, así que estos puzzles funcionan sin conexión y no necesitan cuenta. Unas pequeñas marcas locales recuerdan qué presentación diaria, briefing de jefe y aviso de instalación ya has visto; no contienen datos personales. La página de diagnósticos permite leer, exportar o borrar el registro local de eventos.",
      },
      {
        heading: "Clasificaciones y duelos en línea opcionales",
        body: 'Desactivado hasta que pulsas "Unirse al juego en línea". Un Cloudflare Worker operado por nRn World recibe entonces un nombre público generado, un identificador aleatorio creado en el dispositivo, tu total de estrellas, los tiempos y las líneas trazadas de las partidas diarias, semanales y de duelo (la línea solo verifica el resultado) y tu valoración y victorias/derrotas. Los rivales solo ven el nombre generado y la valoración. No se envía nombre real, correo, ubicación, identificador de dispositivo ni identificador publicitario.',
      },
      {
        heading: "Inicio de sesión con Google opcional",
        body: "Iniciar sesión permite que tu clasificación te siga entre dispositivos. Google solo confirma que el inicio de sesión es auténtico y aporta un número de cuenta estable que el servidor convierte en un identificador hash de un solo sentido. No se leen ni guardan tu nombre, correo ni foto de perfil, y la cuenta nunca se usa para publicidad.",
      },
      {
        heading: "Diagnóstico opcional",
        body: 'Desactivado hasta que activas "Ayúdanos a mejorar el juego" en Ajustes. Solo se registran contadores agregados (nombre del evento, número de nivel y fecha), sin identificador de jugador ni de sesión. Permanecen en el dispositivo y solo se exportan si pides el archivo de diagnóstico, o se envían al mismo worker como contadores anónimos si el juego en línea también está activado. Nunca se usan para publicidad.',
      },
      {
        heading: "Versiones para portales, anuncios y permisos",
        body: "La versión normal web/PWA/Android no carga ningún script de terceros. Las versiones para Playgama o CrazyGames cargan el SDK del portal correspondiente, y las de Playgama pueden mostrar un anuncio tras superar un nivel solo si das tu consentimiento en Ajustes, como máximo una vez cada cinco niveles y con tres minutos de separación. El juego puede usar vibración para la respuesta háptica opcional. No hay compras ni rastreo de terceros en la versión estándar.",
      },
      {
        heading: "Privacidad infantil y eliminación",
        body: "El juego no recopila conscientemente datos personales de menores. Puedes dejar de compartir cuando quieras y pedir por correo que se eliminen tus entradas en la clasificación.",
      },
    ],
    contact: "Las preguntas pueden enviarse a bynrnworld@gmail.com.",
  },
};
