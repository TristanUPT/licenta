# -*- coding: utf-8 -*-
from helpers import *
from docx.shared import Pt, Cm

def chapter4(doc):
    h1(doc, "4", "Soluția propusă și arhitectura sistemului")
    body(doc, "Capitolul de față descrie modul în care a fost gândit sistemul, de la organizarea generală a componentelor până la traseul pe care îl parcurge semnalul audio și la principalele scenarii de utilizare. Sunt prezentate aici deciziile structurale majore, urmând ca detaliile concrete de implementare să fie tratate în capitolul următor.")

    h2(doc, "4.1", "Arhitectura generală")
    body(doc, "Aplicația este împărțită în trei straturi care comunică pe căi bine delimitate. Primul strat este interfața grafică, scrisă în React și TypeScript, responsabilă de afișare și de captarea acțiunilor utilizatorului. Al doilea strat este puntea audio, materializată într-un procesor AudioWorklet care rulează pe firul dedicat sunetului. Al treilea strat este motorul de procesare, scris în Rust și compilat către WebAssembly, care efectuează toate calculele de semnal. Separarea pe aceste straturi nu este una formală, ci reflectă o regulă strictă respectată în tot proiectul: nicio prelucrare audio nu se execută în JavaScript, ci numai în codul nativ.")
    figure(doc, "Arhitectura generală pe trei straturi: interfața React, puntea AudioWorklet și motorul Rust/WebAssembly")
    body(doc, "Comunicarea dintre straturi urmează un flux unidirecțional, ușor de urmărit. Atunci când utilizatorul mișcă un buton rotativ, valoarea ajunge mai întâi în depozitul de stare corespunzător, de unde este transmisă prin mesaj către procesorul AudioWorklet, care la rândul lui apelează funcția potrivită din motorul nativ. În sens invers, datele de analiză — valori de nivel, vârfuri, reducere de câștig — sunt colectate de motor, trimise periodic către firul principal și depuse într-un depozit de analiză, de unde alimentează vizualizările. Această circulație clară a informației, ilustrată în figura următoare, a simplificat considerabil depanarea.")
    figure(doc, "Fluxul de date între interfață, depozitele de stare, puntea audio și motorul DSP")

    h2(doc, "4.2", "Modulul de procesare în Rust și WebAssembly")
    body(doc, "Inima sistemului este un motor stereo construit pe un principiu pe care l-am numit, în cod, proiectarea cu instanțe duble. Fiecare poziție din lanțul de efecte nu conține un singur procesor, ci două instanțe independente ale aceluiași efect — una pentru canalul stâng și una pentru cel drept — ai căror parametri sunt menținuți sincronizați. Am ales această abordare deoarece păstrează intactă imaginea stereo a semnalului prin întregul lanț, fără a fi nevoie să modific implementarea fiecărui efect în parte.")
    body(doc, "Motorul expune către exterior un set restrâns de funcții cu convenția C, precum crearea și distrugerea unei instanțe, adăugarea sau eliminarea unui efect, modificarea unui parametru și procesarea unui bloc de eșantioane. Toate tampoanele sunt alocate o singură dată, la inițializare, iar pe traseul critic de procesare nu se mai face nicio alocare de memorie. Această disciplină este esențială pentru a evita întreruperile, deoarece o alocare neașteptată pe firul audio s-ar traduce într-un artefact sonor.")

    h2(doc, "4.3", "Interfața web și gestiunea stării")
    body(doc, "Interfața este organizată ca un atelier cu trei coloane. În stânga se află un panou de navigare care găzduiește eșantioanele demonstrative și preseturile, în centru se desfășoară forma de undă și lanțul de efecte, iar în dreapta se află panoul de inspecție, cu vizualizările și stratul educațional. În partea de jos, o bară de transport reunește comenzile de redare, controlul de tempo, metronomul și înregistrarea. Această dispunere a fost gândită pentru a păstra permanent în câmpul vizual atât semnalul, cât și efectul fiecărei acțiuni.")
    figure(doc, "Dispunerea generală a interfeței ResoLab, cu cele trei coloane și bara de transport")
    body(doc, "Starea aplicației este distribuită în șapte depozite Zustand, fiecare acoperind un domeniu precis. Depozitul efectelor reține ordinea lanțului, parametrii fiecărui efect și stările de ocolire, gestionând totodată istoricul pentru anulare și refacere. Depozitul audio păstrează fișierul încărcat și starea redării. Depozitul de analiză primește, de la motor, datele de nivel actualizate de aproximativ treizeci de ori pe secundă. Celelalte depozite acoperă starea educațională, preseturile, interfața și sintetizatorul. Această împărțire a menținut codul ordonat pe măsură ce aplicația a crescut.")

    h2(doc, "4.4", "Traseul semnalului audio")
    body(doc, "Pentru a înțelege funcționarea sistemului, este util să urmărim drumul complet al semnalului. Un fișier audio este mai întâi decodat local, prin mecanismul oferit de browser, rezultând un tampon de eșantioane în virgulă mobilă. La redare, acest tampon este furnizat printr-un nod sursă către procesorul AudioWorklet, care îl trece, bloc cu bloc, prin motorul nativ. Rezultatul procesării este scris în tampoanele de ieșire și ajunge la difuzoarele sau căștile utilizatorului. În paralel, un nod de analiză derivă o ramură a semnalului către vizualizări, fără a altera traseul principal.")
    figure(doc, "Traseul semnalului audio, de la decodarea fișierului până la ieșirea către difuzoare")
    body(doc, "Atât sintetizatorul, cât și intrarea de microfon se injectează în același punct al traseului, înaintea lanțului de efecte. Astfel, indiferent de sursă — fișier, sunet sintetizat sau semnal captat live — prelucrarea ulterioară este identică. Această uniformizare a simplificat mult arhitectura, întrucât a permis tratarea tuturor surselor printr-un singur drum de procesare.")

    h2(doc, "4.5", "Cazuri de utilizare")
    body(doc, "Pentru a ancora deciziile de proiectare în nevoi concrete, am identificat câteva scenarii principale de utilizare, dintre care trei sunt prezentate în continuare ca fiind cele mai relevante.")
    h3(doc, "4.5.1", "Procesarea unui fișier audio existent")
    body(doc, "În scenariul cel mai frecvent, utilizatorul aduce un fișier propriu în zona centrală, construiește un lanț de efecte și ajustează parametrii ascultând rezultatul. Pe parcurs, poate compara semnalul procesat cu cel original printr-o singură apăsare și poate consulta explicațiile fiecărui parametru. La final, exportă rezultatul într-un fișier WAV. Acest scenariu pune în mișcare aproape toate componentele aplicației și a constituit firul director al dezvoltării.")
    figure(doc, "Diagramă a fluxului pentru procesarea unui fișier audio existent")
    h3(doc, "4.5.2", "Generarea de sunete cu sintetizatorul")
    body(doc, "Un al doilea scenariu nu pornește de la un fișier, ci de la zero. Utilizatorul activează sintetizatorul și cântă fie de la tastatura calculatorului, fie de la un dispozitiv MIDI conectat, modelând sunetul prin oscilatoare, filtru și anvelopă. Sunetul generat poate fi, la rândul lui, trecut prin lanțul de efecte, ceea ce transformă aplicația într-un mic instrument de explorare sonoră.")
    h3(doc, "4.5.3", "Înregistrarea de la o interfață audio externă")
    body(doc, "Al treilea scenariu vizează utilizatorii care dispun de o interfață audio externă, precum o placă de sunet profesională sau un microfon USB. Aceștia pot alege dispozitivul de intrare dintr-o listă, pot asculta semnalul în timp real și îl pot înregistra direct în aplicație, obținând la final un fișier WAV cu durata corectă. Acest scenariu a impus o atenție deosebită gestiunii permisiunilor și a dispozitivelor.")

def chapter5(doc):
    h1(doc, "5", "Implementarea")
    body(doc, "Capitolul de față coboară la nivelul detaliilor concrete, prezentând modul în care au fost realizate principalele funcționalități ale aplicației. Pentru fiecare componentă sunt descrise rolul pe care îl îndeplinește, principiul de funcționare și fragmentele de cod care o materializează, însoțite, acolo unde este cazul, de capturi din aplicație.")

    h2(doc, "5.1", "Motorul de efecte și lanțul de procesare")
    body(doc, "Motorul stereo este structurat în jurul unui ansamblu de poziții de efect, fiecare conținând câte o instanță separată pentru canalul stâng și pentru cel drept. Structura de date care reprezintă o astfel de poziție reține un identificator, starea de ocolire și cele două instanțe ale efectului, reunite sub o interfață comună.")
    code_block(doc,
"struct EffectSlot {\n"
"    id: u32,\n"
"    bypassed: bool,\n"
"    left: Box<dyn Effect>,\n"
"    right: Box<dyn Effect>,\n"
"}\n\n"
"pub struct Engine {\n"
"    sample_rate: f32,\n"
"    chain: Vec<EffectSlot>,\n"
"    work_l: Vec<f32>, work_r: Vec<f32>,\n"
"    temp_l: Vec<f32>, temp_r: Vec<f32>,\n"
"    blocks_processed: u64,\n"
"}",
"Structura motorului stereo și a unei poziții din lanțul de efecte")
    body(doc, "Toate efectele respectă o interfață comună, definită printr-un tip-trăsătură care impune o metodă de procesare a unui bloc de eșantioane. Această abstractizare permite tratarea uniformă a oricărui efect din lanț, indiferent de algoritmul său intern. Tampoanele de lucru sunt preluate alternativ, după modelul ping-pong, astfel încât ieșirea unui efect devine intrarea următorului, fără copieri suplimentare. Atunci când lanțul este gol, semnalul este pur și simplu copiat la ieșire, ocolind orice procesare.")
    body(doc, "Pe partea de interfață, lanțul este oglindit în depozitul de efecte, care menține ordinea, parametrii și istoricul modificărilor. Fiecare operație asupra lanțului — adăugare, eliminare, reordonare sau schimbare de parametru — este transmisă deopotrivă către motor și înregistrată într-un istoric mărginit, care stă la baza funcțiilor de anulare și refacere.")

    h2(doc, "5.2", "Procesoarele audio implementate")
    body(doc, "Aplicația include șaisprezece procesoare audio, fiecare implementat ca un modul Rust independent. Ele acoperă principalele categorii de prelucrare: dinamică, frecvențială, temporală și de saturație. În continuare sunt detaliate câteva dintre cele mai reprezentative, alese pentru a ilustra abordările diferite de procesare.")
    h3(doc, "5.2.1", "Compresorul dinamic")
    body(doc, "Compresorul reduce diferența dintre pasajele tari și cele slabe ale semnalului, fiind unul dintre cele mai folosite, dar și cele mai greu de înțeles efecte. Implementarea urmează modelul feed-forward descris în literatura de specialitate, cu un genunchi moale care netezește tranziția în jurul pragului [14]. Semnalul de comandă trece printr-un detector de anvelopă, după care o funcție de câștig calculează reducerea necesară.")
    code_block(doc,
"pub const PARAM_THRESHOLD_DB: u32 = 0;\n"
"pub const PARAM_RATIO: u32 = 1;\n"
"pub const PARAM_ATTACK_MS: u32 = 2;\n"
"pub const PARAM_RELEASE_MS: u32 = 3;\n"
"pub const PARAM_KNEE_DB: u32 = 4;\n"
"pub const PARAM_MAKEUP_DB: u32 = 5;\n"
"// detector de anvelopă → calcul câștig → makeup → mix uscat/umed",
"Parametrii compresorului și ordinea etapelor de procesare")
    body(doc, "Valoarea reducerii de câștig este expusă către interfață pentru a alimenta un indicator vizual dedicat, astfel încât utilizatorul să poată vedea, nu doar auzi, cât de mult intervine compresorul. Toți parametrii sunt netezi în timp printr-un filtru de ordinul întâi, ceea ce elimină zgomotul de tip fermoar care ar apărea la modificări bruște.")
    figure(doc, "Cardul compresorului în interfață, cu indicatorul de reducere a câștigului")
    h3(doc, "5.2.2", "Egalizatorul parametric")
    body(doc, "Egalizatorul parametric ajustează balanța frecvențială a semnalului prin patru benzi în cascadă, fiecare putând lua forma unui filtru de tip clopot, prag jos sau înalt, trecere sus sau jos, ori filtru de tăiere. Coeficienții fiecărei benzi sunt recalculați doar la modificarea parametrilor, după formulele consacrate ale lui Robert Bristow-Johnson [15], iar procesarea propriu-zisă constă într-o simplă cascadă de filtre biquad.")
    body(doc, "Pe lângă procesarea în Rust, interfața afișează o curbă de răspuns în frecvență, calculată separat în JavaScript pentru reprezentare vizuală. Această curbă permite utilizatorului să anticipeze efectul reglajelor înainte de a le asculta, ceea ce întărește dimensiunea educativă a aplicației.")
    figure(doc, "Curba de răspuns în frecvență a egalizatorului parametric cu patru benzi")
    h3(doc, "5.2.3", "Reverberația")
    body(doc, "Reverberația simulează reflexiile sunetului într-un spațiu, conferind profunzime semnalului. Implementarea se bazează pe arhitectura Schroeder, cu patru filtre piepten cu reacție și atenuare dispuse în paralel, urmate de două filtre trece-tot în serie [16]. Lungimile liniilor de întârziere pornesc de la valorile clasice ale algoritmului Freeverb, scalate la frecvența de eșantionare curentă.")
    code_block(doc,
"// patru filtre piepten în paralel + două filtre trece-tot în serie\n"
"const COMB_LENGTHS_44K: [usize; 4] = [1116, 1188, 1277, 1356];\n"
"const ALLPASS_LENGTHS_44K: [usize; 2] = [556, 441];\n"
"// atenuarea în bucla de reacție este un filtru trece-jos de ordinul întâi",
"Configurația liniilor de întârziere ale reverberației de tip Schroeder")
    body(doc, "Parametrul de atenuare controlează un filtru trece-jos plasat în bucla de reacție a fiecărui filtru piepten, ceea ce face ca frecvențele înalte să se stingă mai repede decât cele joase, întocmai ca într-un spațiu real. Un predelay, realizat cu o linie de întârziere separată, permite distanțarea reverberației de sunetul direct.")
    h3(doc, "5.2.4", "Celelalte procesoare")
    body(doc, "Pe lângă cele descrise, motorul include un câștig simplu, o poartă de zgomot, un limitator, o întârziere cu reacție, saturație, cor, flanger, deplasare de ton, phaser, modelator de tranzienți, de-esser, expandor și un reductor de zgomot. Fiecare respectă aceeași interfață comună și aceeași disciplină a alocării, diferind doar prin algoritmul intern. Această uniformitate a permis adăugarea treptată de noi efecte fără a modifica motorul.")

    h2(doc, "5.3", "Puntea AudioWorklet")
    body(doc, "Procesorul AudioWorklet face legătura între interfață și motorul nativ, fără a efectua el însuși vreo prelucrare de semnal. La inițializare, el primește octeții modulului WebAssembly, îl instanțiază și alocă tampoanele de intrare și ieșire pentru ambele canale. Mesajele de control sosite de la firul principal sunt traduse în apeluri către funcțiile motorului.")
    code_block(doc,
"process(inputs, outputs) {\n"
"  if (!this.ready) return true;\n"
"  // copiază intrarea în memoria WASM (stânga și dreapta)\n"
"  this.inputView.set(input[0]);\n"
"  this.inputRView.set(input[1] || input[0]);\n"
"  // procesează stereo prin lanțul de efecte\n"
"  this.wasm.process_stereo(this.enginePtr,\n"
"     this.inputPtr, this.inputRPtr,\n"
"     this.outputPtr, this.outputRPtr, RENDER_QUANTUM);\n"
"  output[0].set(this.outputView);\n"
"  output[1].set(this.outputRView);\n"
"  return true;\n"
"}",
"Bucla de procesare a punții AudioWorklet")
    body(doc, "Pentru a evita copierea eșantioanelor, codul folosește vederi de tip tablou tipizat direct peste memoria liniară a modulului WebAssembly. Atunci când motorul detectează o ocolire globală, semnalul este transmis nemodificat de la intrare la ieșire, ceea ce stă la baza comparației rapide între semnalul procesat și cel original. Datele de analiză sunt colectate doar la fiecare câteva blocuri, pentru a nu încărca firul audio cu mesaje prea dese.")

    h2(doc, "5.4", "Sintetizatorul")
    body(doc, "Sintetizatorul este un instrument substractiv polifonic, capabil să redea simultan opt voci. Fiecare voce dispune de două oscilatoare cu posibilitate de dezacordare, o anvelopă de tip atac–cădere–susținere–revenire, un filtru variabil de stare și un oscilator de joasă frecvență pentru modulație. Vocile sunt alocate după vârstă, cea mai veche fiind sacrificată atunci când toate sunt ocupate.")
    body(doc, "Comanda sintetizatorului poate veni fie de la tastatura calculatorului, fie de la un dispozitiv MIDI conectat prin interfața Web MIDI. Peste mecanismul de bază am adăugat un mod de acorduri și un arpegiator, implementat pe firul interfeței printr-un cronometru, care declanșează notele în secvență. Sunetul rezultat se injectează în lanțul de efecte, putând fi astfel modelat suplimentar.")
    figure(doc, "Panoul sintetizatorului, cu oscilatoarele, filtrul și anvelopa")

    h2(doc, "5.5", "Înregistrarea și selecția interfeței audio")
    body(doc, "Modulul de înregistrare captează ieșirea procesată a aplicației și o salvează într-un fișier audio. Pentru a oferi flexibilitate utilizatorilor cu echipament profesional, butonul de microfon deschide un selector care enumeră dispozitivele de intrare disponibile. Dacă browserul nu a primit încă permisiunea de acces, etichetele dispozitivelor apar goale, motiv pentru care codul solicită mai întâi permisiunea, apoi reia enumerarea.")
    code_block(doc,
"let devices = await navigator.mediaDevices.enumerateDevices()\n"
"let inputs = devices.filter((d) => d.kind === 'audioinput')\n"
"if (inputs.length > 0 && inputs[0].label === '') {\n"
"  const tmp = await navigator.mediaDevices.getUserMedia({ audio: true })\n"
"  tmp.getTracks().forEach((t) => t.stop())\n"
"  devices = await navigator.mediaDevices.enumerateDevices()\n"
"  inputs = devices.filter((d) => d.kind === 'audioinput')\n"
"}",
"Enumerarea dispozitivelor de intrare cu solicitarea prealabilă a permisiunii")
    body(doc, "După alegerea unui dispozitiv, semnalul este captat prin cererea explicită a acelei surse și conectat în motor. Un comutator de monitorizare permite ascultarea directă a intrării, însoțit de un avertisment privind riscul de microfonie atunci când nu se folosesc căști. Toate erorile posibile — permisiune refuzată, dispozitiv indisponibil — sunt afișate în interfață, nu doar consemnate în consolă.")
    figure(doc, "Selectorul de interfață audio și comutatorul de monitorizare")
    body(doc, "Un aspect care a necesitat o atenție deosebită a fost cronometrul de înregistrare. Inițial, durata afișată rămânea blocată la zero, deoarece nu fusese pornit un mecanism de actualizare. Soluția a constat în declanșarea unui interval care incrementează un contor de secunde, oprit la finalul înregistrării, cu o gardă care împiedică pornirea dublă atunci când butonul este apăsat de două ori în succesiune rapidă.")

    h2(doc, "5.6", "Metronomul cu programare anticipată")
    body(doc, "Metronomul produce un click ritmic stabil, util pentru exersare. Provocarea principală în realizarea lui a fost precizia temporală: un cronometru obișnuit din JavaScript suferă de fluctuații care ar face pulsul neregulat. Soluția adoptată este tehnica programării anticipate, recunoscută ca standard în domeniul Web Audio [17]. Un cronometru rar inspectează periodic o fereastră de timp apropiată și programează în avans toate bătăile care urmează să cadă în interiorul ei.")
    code_block(doc,
"function scheduler() {\n"
"  while (nextNoteTime < ctx.currentTime + LOOKAHEAD_SEC) {\n"
"    const accented = currentBeat === 0\n"
"    scheduleClick(nextNoteTime, currentBeat, accented)\n"
"    nextNoteTime += 60.0 / bpm\n"
"    currentBeat = (currentBeat + 1) % beatsPerMeasure\n"
"  }\n"
"  timerID = setTimeout(scheduler, SCHEDULE_INTERVAL_MS)\n"
"}",
"Programatorul anticipat al metronomului")
    body(doc, "Fiecare click este generat de un oscilator de scurtă durată, cu o anvelopă rapidă, fără a recurge la fișiere audio externe. Prima bătaie a fiecărei măsuri folosește o frecvență mai înaltă și un volum mai mare, marcând accentul, în funcție de metrul ales dintre valorile uzuale. Tempoul poate fi reglat între patruzeci și două sute patruzeci de bătăi pe minut, prin butoane, editare directă sau rotița mausului, iar modificarea sa în timpul rulării actualizează imediat programarea, fără a opri pulsul.")
    figure(doc, "Controlul de tempo și butonul de metronom din bara de transport")

    h2(doc, "5.7", "Exportul în format WAV")
    body(doc, "La finalul prelucrării, utilizatorul poate exporta rezultatul într-un fișier WAV. Exportul nu se bazează pe redarea în timp real, ci pe o procesare în regim offline: tamponul sursă este trecut, bloc cu bloc, printr-o instanță proaspătă a motorului, cu același lanț de efecte, după o etapă de încălzire care lasă filtrele și netezitoarele să se stabilizeze. Rezultatul este apoi codat ca flux PCM pe șaisprezece biți.")
    body(doc, "Un detaliu subtil, dar important, a fost corectitudinea antetului WAV. La înregistrarea în flux, dimensiunile finale ale datelor nu sunt cunoscute de la început, ceea ce poate produce un fișier a cărui durată este afișată greșit de playere. Soluția a fost rescrierea antetului cu valorile corecte ale dimensiunii totale și ale blocului de date după ce toate eșantioanele au fost adunate, astfel încât fișierul rezultat să fie recunoscut corect de orice player extern.")
    figure(doc, "Structura antetului WAV cu câmpurile de dimensiune corectate")

    h2(doc, "5.8", "Vizualizările")
    body(doc, "Stratul de vizualizare traduce semnalul în reprezentări grafice actualizate în timp real, esențiale pentru dimensiunea educativă a aplicației. Panoul de vizualizare oferă patru perspective complementare: spectrul instantaneu, spectrograma care urmărește evoluția spectrului în timp, osciloscopul care arată forma de undă și un mod de comparație care îngheață un spectru de referință alături de semnalul curent. Toate reprezentările sunt desenate folosind mecanismul de animație al browserului, sincronizat cu reîmprospătarea ecranului.")
    body(doc, "Pe lângă acestea, interfața afișează indicatoare de nivel pentru vârf și valoare eficace, un indicator de reducere a câștigului pentru compresor și o măsură a tăriei sonore integrate, calculată după recomandarea internațională în domeniu. Aceste instrumente oferă utilizatorului un limbaj vizual prin care poate corela ceea ce aude cu ceea ce se întâmplă, de fapt, cu semnalul.")
    figure(doc, "Panoul de vizualizare cu spectrul în timp real și spectrograma")

    h2(doc, "5.9", "Stratul educațional")
    body(doc, "Componenta care diferențiază cel mai puternic ResoLab de instrumentele existente este stratul educațional. Acesta nu se rezumă la texte statice, ci analizează configurația curentă a lanțului de efecte și formulează observații adaptate valorilor reale ale parametrilor. Un motor de reguli, scris în TypeScript, examinează fiecare efect și semnalează situațiile problematice — un prag prea coborât, un raport exagerat, o ordonare nepotrivită a efectelor — oferind explicații în limbaj accesibil sau tehnic, după preferința utilizatorului.")
    body(doc, "În completare, un motor de recomandări analizează conținutul spectral al semnalului și propune efecte potrivite, pe baza unor reguli euristice. De exemplu, un vârf de nivel apropiat de saturație sugerează adăugarea unui limitator, iar un factor de creastă ridicat indică oportunitatea unei compresii. Întreaga logică se bazează pe analiză de semnal, nu pe metode de învățare automată, ceea ce o face transparentă și explicabilă — o calitate aliniată cu scopul didactic al aplicației.")
    figure(doc, "Panoul de feedback dinamic și panoul de recomandări")
    body(doc, "Toate textele explicative sunt disponibile în limba română și în limba engleză, în două registre de complexitate. Comutarea între nivelul de începător și cel avansat se face dintr-un singur loc, în antet, și se reflectă instantaneu în toate explicațiile afișate.")

    h2(doc, "5.10", "Tutorialul ghidat")
    body(doc, "Pentru a-i orienta pe utilizatorii aflați la prima vizită, aplicația include un tutorial ghidat de tip reflector. Acesta întunecă întreaga interfață, decupând doar zona relevantă pentru pasul curent, în jurul căreia plasează o casetă explicativă. Poziția decupajului este calculată dinamic, pe baza dimensiunilor reale ale elementului vizat, iar caseta este așezată inteligent deasupra, dedesubt sau în lateral, astfel încât să nu iasă din cadru.")
    body(doc, "Tutorialul parcurge șase pași, de la încărcarea unui fișier până la export, fiecare însoțit de o explicație scurtă și de un indicator de progres. La redimensionarea ferestrei, poziția reflectorului este recalculată instantaneu, astfel încât evidențierea să rămână corectă. Acest ghid inițial reduce semnificativ pragul de intrare pentru utilizatorii fără experiență.")
    figure(doc, "Un pas din tutorialul ghidat, cu zona evidențiată și caseta explicativă")
