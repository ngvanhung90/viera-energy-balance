// Entries match catalog order for display only. IDs, weights and planning data stay canonical.
const meals = {
  lemongrass: {
    vi: ['Cơm gà sả', 'Gà sả áp chảo, cơm gạo thơm, dưa leo giòn và rau thơm.',
      ['Ức gà sống', 'Cơm gạo thơm', 'Dưa leo', 'Cà rốt', 'Dầu ăn trung tính', 'Sả', 'Chanh, bạc hà và tỏi', 'Nước mắm'],
      [['Chuẩn bị rau', 'Thái dưa leo và cà rốt. Băm sả và tỏi. Để riêng rau và rau thơm.'], ['Ướp gà', 'Thái gà trên thớt riêng rồi trộn với sả, tỏi, nước mắm, chanh và nửa lượng dầu.'], ['Áp chảo và kiểm tra', 'Đun phần dầu còn lại, dàn gà một lớp và lật khi vàng. Dùng nhiệt kế kiểm tra miếng dày nhất đạt 74 °C.'], ['Bày ra tô', 'Cho cơm ấm, gà, rau sống và rau thơm vào tô. Thêm chanh tươi.']]],
    es: ['Bol de pollo con limoncillo', 'Pollo salteado con limoncillo, arroz jazmín, pepino y hierbas.',
      ['Pechuga de pollo cruda', 'Arroz jazmín cocido', 'Pepino', 'Zanahoria', 'Aceite neutro', 'Limoncillo', 'Lima, menta y ajo', 'Salsa de pescado'],
      [['Prepara las verduras', 'Corta el pepino y la zanahoria. Pica el limoncillo y el ajo. Reserva las verduras y las hierbas.'], ['Sazona el pollo', 'Corta el pollo en otra tabla y mézclalo con limoncillo, ajo, salsa de pescado, lima y la mitad del aceite.'], ['Dora y comprueba', 'Calienta el aceite restante y dora el pollo en una sola capa, dándole la vuelta. Comprueba que el centro de las piezas más gruesas alcance 74 °C.'], ['Monta el bol', 'Sirve arroz templado con pollo, verduras crudas, hierbas y lima fresca.']]],
    fr: ['Bol de poulet à la citronnelle', 'Poulet poêlé, riz jasmin, concombre croquant et herbes fraîches.',
      ['Blanc de poulet cru', 'Riz jasmin cuit', 'Concombre', 'Carotte', 'Huile neutre', 'Citronnelle', 'Citron vert, menthe et ail', 'Sauce de poisson'],
      [['Préparer les légumes', 'Émincez le concombre et la carotte. Hachez la citronnelle et l’ail. Réservez les légumes et les herbes.'], ['Assaisonner le poulet', 'Coupez le poulet sur une planche à part. Mélangez-le avec la citronnelle, l’ail, la sauce de poisson, le citron vert et la moitié de l’huile.'], ['Saisir et contrôler', 'Chauffez le reste de l’huile. Dorez le poulet en une couche et retournez les morceaux. Vérifiez que le cœur des plus épais atteint 74 °C.'], ['Assembler le bol', 'Servez le riz chaud avec le poulet, les légumes crus, les herbes et du citron vert frais.']]]
  },
  pasta: {
    vi: ['Penne cà chua nướng và húng quế', 'Cà chua nướng ngọt, mì nguyên cám và húng quế xé.',
      ['Penne nguyên cám khô', 'Cà chua bi', 'Dầu ô liu', 'Phô mai cứng chay', 'Húng quế và tỏi'],
      [['Nướng cà chua', 'Làm nóng lò đến 220 °C. Trộn cà chua và tỏi với dầu rồi nướng đến khi cà chua nứt.'], ['Luộc mì', 'Luộc penne trong nước muối theo hướng dẫn trên gói. Giữ lại một ít nước luộc trước khi chắt.'], ['Trộn và dùng', 'Nghiền nhẹ cà chua, cho mì và thêm từng ít nước luộc để tạo sốt bóng. Thêm húng quế và phô mai bào.']]],
    es: ['Penne con tomate asado y albahaca', 'Tomates dulces asados, pasta integral y albahaca fresca.',
      ['Penne integral seco', 'Tomates cherry', 'Aceite de oliva', 'Queso duro vegetariano', 'Albahaca y ajo'],
      [['Asa los tomates', 'Precalienta a 220 °C. Mezcla los tomates y el ajo con aceite y ásalos hasta que revienten.'], ['Cuece la pasta', 'Cuece los penne en agua salada según el envase. Reserva un poco del agua de cocción antes de escurrir.'], ['Mezcla y sirve', 'Aplasta ligeramente los tomates, añade la pasta y un poco del agua reservada. Termina con albahaca y queso rallado.']]],
    fr: ['Penne aux tomates rôties et au basilic', 'Tomates rôties, pâtes complètes et basilic frais.',
      ['Penne complets secs', 'Tomates cerises', 'Huile d’olive', 'Fromage à pâte dure végétarien', 'Basilic et ail'],
      [['Rôtir les tomates', 'Préchauffez le four à 220 °C. Mélangez les tomates et l’ail avec l’huile et faites rôtir jusqu’à ce que les tomates éclatent.'], ['Cuire les pâtes', 'Faites cuire les penne à l’eau salée selon l’emballage. Réservez un peu d’eau de cuisson avant d’égoutter.'], ['Mélanger et servir', 'Écrasez légèrement les tomates, ajoutez les pâtes et un peu d’eau réservée. Terminez avec le basilic et le fromage râpé.']]]
  },
  soba: {
    vi: ['Mì soba đậu phụ giòn', 'Đậu phụ vàng giòn, mì kiều mạch dai và đậu edamame xanh.',
      ['Mì soba khô', 'Đậu phụ cứng', 'Đậu edamame bóc vỏ', 'Dầu mè', 'Nước tương', 'Hành lá và chanh'],
      [['Luộc mì và đậu', 'Luộc soba và edamame theo hướng dẫn trên gói. Chắt nước mì rồi xả nhanh bằng nước mát.'], ['Áp chảo đậu phụ', 'Thấm khô đậu phụ, cắt khối và áp chảo với dầu. Lật khi từng mặt đã vàng.'], ['Trộn sốt', 'Trộn nước tương, chanh và dầu mè còn lại với mì và edamame. Thêm đậu phụ và hành lá.']]],
    es: ['Soba con tofu crujiente', 'Tofu dorado, fideos de trigo sarraceno y edamame.',
      ['Fideos soba secos', 'Tofu firme', 'Edamame sin vaina', 'Aceite de sésamo', 'Salsa de soja', 'Cebolleta y lima'],
      [['Cuece los fideos y el edamame', 'Hierve ambos según sus envases. Escurre los fideos y acláralos con agua fresca.'], ['Dora el tofu', 'Seca el tofu, córtalo en cubos y dóralos en aceite por cada lado.'], ['Aliña el bol', 'Mezcla soja, lima y el aceite restante con los fideos y el edamame. Añade el tofu y la cebolleta.']]],
    fr: ['Soba au tofu croustillant', 'Tofu doré, nouilles de sarrasin et edamame.',
      ['Nouilles soba sèches', 'Tofu ferme', 'Edamame écossés', 'Huile de sésame', 'Sauce soja', 'Cébette et citron vert'],
      [['Cuire les nouilles et les edamame', 'Faites-les cuire selon leurs emballages. Égouttez les nouilles et rincez-les rapidement à l’eau fraîche.'], ['Dorer le tofu', 'Épongez le tofu, coupez-le en cubes et faites dorer chaque face dans l’huile.'], ['Assaisonner le bol', 'Mélangez sauce soja, citron vert et huile restante avec les nouilles et les edamame. Ajoutez le tofu et la cébette.']]]
  },
  salmon: {
    vi: ['Cá hồi chanh và khoai tây', 'Cá hồi nướng chanh, khoai tây non và rau chân vịt.',
      ['Cá hồi Đại Tây Dương sống', 'Khoai tây non', 'Rau chân vịt', 'Dầu ô liu', 'Chanh vàng và mùi tây'],
      [['Nướng khoai tây', 'Bổ đôi khoai, trộn với nửa lượng dầu và nướng ở 220 °C đến gần mềm.'], ['Thêm cá hồi', 'Xoa dầu còn lại, chanh và mùi tây lên cá. Nướng trên cùng khay đến khi phần dày nhất đạt 63 °C.'], ['Làm chín rau', 'Làm rau chân vịt vừa mềm với ít nước. Bày cùng cá và khoai, vắt thêm chanh.']]],
    es: ['Salmón al limón con patatas', 'Salmón asado al limón servido con patatas pequeñas y espinacas.',
      ['Salmón atlántico crudo', 'Patatas pequeñas', 'Espinacas', 'Aceite de oliva', 'Limón y perejil'],
      [['Empieza por las patatas', 'Parte las patatas por la mitad, mézclalas con medio aceite y ásalas a 220 °C hasta que estén casi tiernas.'], ['Añade el salmón', 'Unta el salmón con el aceite restante, limón y perejil. Asa en la misma bandeja hasta que el centro alcance 63 °C.'], ['Ablanda las espinacas', 'Saltea las espinacas con un poco de agua. Sirve con el salmón, las patatas y limón.']]],
    fr: ['Saumon au citron et pommes de terre', 'Saumon rôti au citron, pommes de terre nouvelles et épinards.',
      ['Saumon atlantique cru', 'Pommes de terre nouvelles', 'Épinards', 'Huile d’olive', 'Citron et persil'],
      [['Commencer par les pommes de terre', 'Coupez-les en deux, mélangez avec la moitié de l’huile et faites rôtir à 220 °C jusqu’à ce qu’elles soient presque tendres.'], ['Ajouter le saumon', 'Enduisez le saumon d’huile, de citron et de persil. Enfournez sur la même plaque jusqu’à 63 °C à cœur.'], ['Faire tomber les épinards', 'Chauffez les épinards avec un peu d’eau. Servez avec le saumon, les pommes de terre et du citron.']]]
  },
  rolls: {
    vi: ['Gỏi cuốn tôm và rau thơm', 'Bánh tráng cuốn tôm chín, rau thơm, chấm nước mắm chanh.',
      ['Bánh tráng khô', 'Tôm chín ăn liền', 'Bún gạo đã nấu và làm lạnh', 'Dưa leo và cà rốt', 'Xà lách và rau thơm', 'Chanh và nước mắm'],
      [['Chuẩn bị nhân', 'Cắt rau thành que mảnh. Thấm khô tôm chín lạnh, bày bún, xà lách và rau thơm.'], ['Làm mềm và cuốn', 'Nhúng nhanh từng bánh tráng vào nước mát. Đặt lên thớt ẩm, thêm nhân gần mép dưới, gấp hai bên rồi cuốn chặt.'], ['Pha nước chấm', 'Khuấy nước chanh, nước mắm và ít nước mát. Dùng ngay với gỏi cuốn.']]],
    es: ['Rollitos de gambas y hierbas', 'Rollitos frescos de papel de arroz, gambas cocidas y salsa de lima.',
      ['Papel de arroz seco', 'Gambas cocidas listas para comer', 'Fideos de arroz cocidos y fríos', 'Pepino y zanahoria', 'Lechuga y hierbas frescas', 'Lima y salsa de pescado'],
      [['Prepara el relleno', 'Corta las verduras en bastones finos. Seca las gambas cocidas y dispón fideos, lechuga y hierbas.'], ['Ablanda y enrolla', 'Sumerge cada hoja brevemente en agua fresca. Ponla sobre una tabla húmeda, añade relleno abajo, dobla los lados y enrolla.'], ['Mezcla la salsa', 'Mezcla zumo de lima, salsa de pescado y un poco de agua. Sirve de inmediato.']]],
    fr: ['Rouleaux aux crevettes et aux herbes', 'Rouleaux frais de galette de riz, crevettes cuites et sauce au citron vert.',
      ['Galettes de riz sèches', 'Crevettes cuites prêtes à manger', 'Vermicelles de riz cuits et refroidis', 'Concombre et carotte', 'Laitue et herbes fraîches', 'Citron vert et sauce de poisson'],
      [['Préparer la garniture', 'Taillez les légumes en bâtonnets. Épongez les crevettes cuites froides et disposez les vermicelles, la laitue et les herbes.'], ['Ramollir et rouler', 'Trempez brièvement une galette dans l’eau fraîche. Posez-la sur une planche humide, ajoutez la garniture en bas, repliez les côtés et roulez.'], ['Mélanger la sauce', 'Mélangez le jus de citron vert, la sauce de poisson et un peu d’eau fraîche. Servez aussitôt.']]]
  },
  chickpea: {
    vi: ['Tô đậu gà, ớt chuông và sữa chua', 'Ớt chuông nướng, đậu gà ấm và sốt sữa chua chanh mát.',
      ['Đậu gà chín đã chắt nước', 'Ớt chuông', 'Bulgur đã nấu', 'Sữa chua Hy Lạp không đường', 'Dầu ô liu', 'Chanh vàng và mùi tây'],
      [['Nướng đậu và ớt', 'Thấm khô đậu gà, trộn với ớt chuông thái lát và dầu. Nướng ở 220 °C đến khi ớt mềm.'], ['Pha sốt', 'Trộn nước chanh và mùi tây băm với sữa chua.'], ['Bày ra tô', 'Cho bulgur vào tô, thêm đậu gà và ớt chuông còn ấm, rưới sốt.']]],
    es: ['Bol de garbanzos, pimiento y yogur', 'Pimiento asado, garbanzos templados y aliño de yogur al limón.',
      ['Garbanzos cocidos y escurridos', 'Pimiento', 'Bulgur cocido', 'Yogur griego natural', 'Aceite de oliva', 'Limón y perejil'],
      [['Asa los garbanzos y el pimiento', 'Seca los garbanzos y mézclalos con pimiento en tiras y aceite. Asa a 220 °C hasta que el pimiento esté tierno.'], ['Mezcla el aliño', 'Añade zumo de limón y perejil picado al yogur.'], ['Monta el bol', 'Sirve el bulgur con garbanzos y pimiento templados, y añade el aliño.']]],
    fr: ['Bol de pois chiches, poivron et yaourt', 'Poivron rôti, pois chiches tièdes et sauce au yaourt citronnée.',
      ['Pois chiches cuits et égouttés', 'Poivron', 'Boulgour cuit', 'Yaourt grec nature', 'Huile d’olive', 'Citron et persil'],
      [['Rôtir les pois chiches et le poivron', 'Séchez les pois chiches et mélangez avec le poivron en lanières et l’huile. Enfournez à 220 °C jusqu’à ce que le poivron soit tendre.'], ['Préparer la sauce', 'Incorporez le jus de citron et le persil haché au yaourt.'], ['Assembler le bol', 'Servez le boulgour avec les pois chiches et le poivron tièdes, puis ajoutez la sauce.']]]
  }
};

const activities = {
  stretch: {
    vi: ['Thư giãn và giãn cơ', ['Xoay vai nhẹ và thở thư giãn.', 'Xoay cổ chân và gập hông nhẹ, dùng ghế hỗ trợ.', 'Giãn bắp chân và ngực trong phạm vi thoải mái.']],
    es: ['Relajación y estiramientos', ['Empieza con círculos suaves de hombros y respiración relajada.', 'Haz círculos con los tobillos y flexiona suavemente la cadera con apoyo de una silla.', 'Estira pantorrillas y pecho sin forzar.']],
    fr: ['Détente et étirements', ['Commencez par des rotations d’épaules et une respiration calme.', 'Faites des cercles de cheville et de légères flexions de hanche avec une chaise en appui.', 'Étirez doucement les mollets et la poitrine.']]
  },
  walk: {
    vi: ['Đi bộ nhanh quanh khu phố', ['Đi chậm 4 phút để khởi động.', 'Đi nhanh 12 phút ở nhịp vẫn nói chuyện được.', 'Giảm tốc trong 4 phút cuối.']],
    es: ['Paseo rápido por el barrio', ['Camina despacio 4 minutos para calentar.', 'Camina rápido 12 minutos a un ritmo que te permita hablar.', 'Reduce el ritmo los últimos 4 minutos.']],
    fr: ['Marche rapide dans le quartier', ['Marchez tranquillement 4 minutes pour vous échauffer.', 'Marchez vite 12 minutes à un rythme qui vous permet de parler.', 'Ralentissez durant les 4 dernières minutes.']]
  },
  cycle: {
    vi: ['Đạp xe nhẹ', ['Đạp chậm 5 phút trên đường an toàn hoặc xe đạp tại chỗ.', 'Đạp đều 15 phút ở nhịp vẫn nói chuyện được.', 'Đạp chậm trong 5 phút cuối.']],
    es: ['Vuelta suave en bicicleta', ['Pedalea suave 5 minutos por una ruta segura o en una bicicleta estática.', 'Mantén 15 minutos un ritmo que te permita hablar.', 'Pedalea despacio los últimos 5 minutos.']],
    fr: ['Sortie vélo tranquille', ['Pédalez doucement 5 minutes sur un trajet sûr ou sur un vélo d’intérieur.', 'Roulez 15 minutes à un rythme qui vous permet de parler.', 'Pédalez doucement les 5 dernières minutes.']]
  },
  jog: {
    vi: ['Chạy nhẹ cho người chạy thường xuyên', ['Khởi động bằng 5 phút đi bộ nhanh.', 'Chạy nhẹ ở nhịp quen thuộc 15 phút, chuyển sang đi bộ khi cần.', 'Thả lỏng với 5 phút đi bộ.']],
    es: ['Trote suave para corredores habituales', ['Calienta con 5 minutos de paseo rápido.', 'Trota 15 minutos a tu ritmo habitual y camina cuando lo necesites.', 'Termina con 5 minutos de paseo.']],
    fr: ['Footing léger pour habitués', ['Échauffez-vous avec 5 minutes de marche rapide.', 'Courez 15 minutes à votre allure habituelle et marchez si besoin.', 'Terminez par 5 minutes de marche.']]
  }
};

Object.assign(meals, {
  'edamame-rice': {
    vi: ['Cơm đậu edamame và dưa leo', 'Cơm ấm, đậu edamame giòn ngọt và dưa leo.', ['Cơm hạt dài đã nấu', 'Đậu edamame đã chế biến', 'Dưa leo', 'Nước tương'], [['Làm nóng', 'Chế biến đậu theo hướng dẫn trên gói, dùng cơm mới nấu.'], ['Bày ra tô', 'Thái dưa leo, thêm cơm và đậu rồi rưới nước tương.']]],
    es: ['Bol de arroz, edamame y pepino', 'Arroz templado con edamame, pepino y soja.', ['Arroz largo cocido', 'Edamame preparado', 'Pepino', 'Salsa de soja'], [['Calienta', 'Prepara el edamame según el envase y usa arroz recién cocido.'], ['Monta el bol', 'Corta el pepino, añade arroz y edamame, y termina con soja.']]],
    fr: ['Bol de riz, edamame et concombre', 'Riz chaud, edamame et concombre croquant.', ['Riz long cuit', 'Edamame préparé', 'Concombre', 'Sauce soja'], [['Réchauffer', 'Préparez l’edamame selon le paquet et utilisez du riz fraîchement cuit.'], ['Assembler', 'Coupez le concombre, ajoutez riz et edamame, puis la sauce soja.']]]
  },
  'tofu-quinoa': {
    vi: ['Đậu phụ áp chảo với quinoa', 'Đậu phụ, quinoa và rau chân vịt xào nước tương.', ['Đậu phụ cứng', 'Quinoa đã nấu', 'Rau chân vịt', 'Dầu ô liu', 'Nước tương'], [['Áp chảo', 'Thấm khô đậu, cắt khối và áp chảo với dầu.'], ['Thêm rau', 'Đảo rau đến khi mềm, thêm nước tương và dùng với quinoa ấm.']]],
    es: ['Tofu con soja y quinoa', 'Tofu dorado, quinoa y espinacas.', ['Tofu firme', 'Quinoa cocida', 'Espinacas', 'Aceite de oliva', 'Salsa de soja'], [['Dora el tofu', 'Seca el tofu, córtalo en cubos y dóralo en el aceite.'], ['Añade las verduras', 'Saltea las espinacas, añade soja y sirve sobre quinoa caliente.']]],
    fr: ['Tofu au soja et quinoa', 'Tofu poêlé, quinoa et épinards.', ['Tofu ferme', 'Quinoa cuit', 'Épinards', 'Huile d’olive', 'Sauce soja'], [['Dorer le tofu', 'Épongez le tofu, coupez-le en cubes et faites-le dorer dans l’huile.'], ['Ajouter les légumes', 'Faites tomber les épinards, ajoutez la sauce soja et servez sur le quinoa chaud.']]]
  },
  'egg-rice': {
    vi: ['Cơm trứng luộc và bơ', 'Cơm, trứng luộc chín, bơ và nước tương.', ['Cơm hạt dài đã nấu', 'Trứng luộc chín', 'Quả bơ', 'Nước tương'], [['Chuẩn bị', 'Dùng cơm nóng. Luộc trứng đến khi lòng trắng và lòng đỏ đông hoàn toàn.'], ['Bày ra tô', 'Bóc vỏ, cắt trứng làm tư, thêm bơ thái lát và nước tương.']]],
    es: ['Bol de arroz, huevo y aguacate', 'Arroz con huevo duro, aguacate y soja.', ['Arroz largo cocido', 'Huevo duro', 'Aguacate', 'Salsa de soja'], [['Prepara', 'Usa arroz caliente y cuece los huevos hasta que clara y yema estén firmes.'], ['Monta el bol', 'Pela y corta los huevos. Añade aguacate y salsa de soja.']]],
    fr: ['Bol de riz, œuf et avocat', 'Riz, œuf dur, avocat et sauce soja.', ['Riz long cuit', 'Œuf dur', 'Avocat', 'Sauce soja'], [['Préparer', 'Utilisez du riz chaud et faites cuire les œufs jusqu’à ce que blanc et jaune soient fermes.'], ['Assembler', 'Écalez et coupez les œufs. Ajoutez l’avocat et la sauce soja.']]]
  },
  'lentil-salad': {
    vi: ['Salad đậu lăng ấm và cà chua', 'Đậu lăng với cà chua, dưa leo và sốt chanh.', ['Đậu lăng chín để ráo', 'Cà chua', 'Dưa leo', 'Dầu ô liu', 'Nước chanh vàng'], [['Chuẩn bị', 'Hâm đậu đã để ráo, cắt hạt lựu cà chua và dưa leo.'], ['Trộn salad', 'Khuấy dầu ô liu với nước chanh và trộn đều.']]],
    es: ['Ensalada templada de lentejas y tomate', 'Lentejas, tomate, pepino y aliño de limón.', ['Lentejas cocidas y escurridas', 'Tomate', 'Pepino', 'Aceite de oliva', 'Zumo de limón'], [['Prepara', 'Calienta las lentejas escurridas y corta tomate y pepino en dados.'], ['Aliña', 'Mezcla aceite y zumo de limón y aliña la ensalada.']]],
    fr: ['Salade tiède de lentilles et tomates', 'Lentilles, tomates, concombre et citron.', ['Lentilles cuites et égouttées', 'Tomate', 'Concombre', 'Huile d’olive', 'Jus de citron'], [['Préparer', 'Réchauffez les lentilles égouttées. Coupez tomate et concombre en dés.'], ['Assaisonner', 'Mélangez huile et citron, puis versez sur la salade.']]]
  },
  'tuna-potatoes': {
    vi: ['Cá ngừ, khoai tây và rau chân vịt', 'Khoai luộc, cá ngừ hộp, rau chân vịt và chanh.', ['Cá ngừ hộp ngâm nước, để ráo', 'Khoai tây luộc', 'Rau chân vịt', 'Dầu ô liu', 'Nước chanh vàng'], [['Luộc khoai', 'Gọt, cắt khối và luộc khoai đến khi xiên mềm, rồi để ráo.'], ['Bày ra đĩa', 'Đảo rau với ít nước đến khi mềm. Thêm khoai, cá, dầu và chanh.']]],
    es: ['Plato de atún, patata y espinacas', 'Patatas tiernas, atún, espinacas y limón.', ['Atún claro al natural escurrido', 'Patatas cocidas', 'Espinacas', 'Aceite de oliva', 'Zumo de limón'], [['Cuece las patatas', 'Pélalas, córtalas en cubos, hiérvelas hasta que estén tiernas y escúrrelas.'], ['Sirve', 'Saltea las espinacas con un poco de agua. Añade patatas, atún, aceite y limón.']]],
    fr: ['Thon, pommes de terre et épinards', 'Pommes de terre tendres, thon, épinards et citron.', ['Thon au naturel égoutté', 'Pommes de terre bouillies', 'Épinards', 'Huile d’olive', 'Jus de citron'], [['Cuire les pommes de terre', 'Pelez, coupez en cubes et faites bouillir jusqu’à ce qu’elles soient tendres. Égouttez.'], ['Assembler', 'Faites tomber les épinards avec un peu d’eau. Ajoutez pommes de terre, thon, huile et citron.']]]
  },
  'yogurt-oats': {
    vi: ['Yến mạch ấm và sữa chua', 'Yến mạch nấu mềm với sữa chua Hy Lạp.', ['Yến mạch cán khô', 'Sữa chua Hy Lạp không béo'], [['Nấu yến mạch', 'Nấu yến mạch với nước theo hướng dẫn trên gói, khuấy đến khi mềm.'], ['Hoàn tất', 'Tắt bếp và múc sữa chua lên trên.']]],
    es: ['Avena caliente con yogur', 'Avena integral con yogur griego natural.', ['Copos de avena secos', 'Yogur griego natural desnatado'], [['Cuece la avena', 'Cuécela en agua según el envase y remueve hasta que esté tierna.'], ['Termina', 'Retira del fuego y añade el yogur.']]],
    fr: ['Flocons d’avoine chauds au yaourt', 'Avoine chaude et yaourt grec nature.', ['Flocons d’avoine secs', 'Yaourt grec nature sans matières grasses'], [['Cuire l’avoine', 'Faites cuire dans l’eau selon le paquet et remuez jusqu’à tendreté.'], ['Terminer', 'Retirez du feu et ajoutez le yaourt.']]]
  }
});

Object.assign(activities, {
  cardio: {
    vi: ['Cardio nhảy ít tác động', ['Dọn một khoảng trống và đi tại chỗ nhẹ để khởi động.', 'Luân phiên bước ngang và vung tay ở nhịp vẫn nói chuyện được. Luôn giữ một chân chạm sàn.', 'Giảm tốc và kết thúc bằng bước chậm.']],
    es: ['Baile cardiovascular de bajo impacto', ['Despeja el espacio y calienta marchando suavemente.', 'Alterna pasos laterales y balanceos de brazos a un ritmo que permita hablar. Mantén un pie en el suelo.', 'Reduce el ritmo y termina con pasos suaves.']],
    fr: ['Danse cardio à faible impact', ['Dégagez l’espace et échauffez-vous en marchant sur place.', 'Alternez pas latéraux et balancements des bras en gardant un rythme qui permet de parler. Gardez un pied au sol.', 'Ralentissez et terminez par des pas tranquilles.']]
  },
  yoga: {
    vi: ['Yoga đứng nhẹ nhàng', ['Đứng thoải mái, hai chân tách nhẹ và thở bình thường.', 'Từ từ nâng hạ tay; nghiêng người nhẹ trong tầm thoải mái.', 'Đứng thư giãn. Dừng nếu đau hoặc chóng mặt.']],
    es: ['Yoga suave de pie', ['Ponte de pie cómodamente y respira con naturalidad.', 'Sube y baja los brazos. Inclínate suavemente hacia los lados sin forzar.', 'Vuelve a una postura relajada. Para si sientes dolor o mareo.']],
    fr: ['Yoga doux debout', ['Tenez-vous debout, pieds écartés, et respirez normalement.', 'Levez puis baissez les bras. Inclinez-vous légèrement sur les côtés.', 'Revenez à une posture détendue. Arrêtez si vous avez mal ou êtes étourdi.']]
  },
  strength: {
    vi: ['Bài sức mạnh có ghế hỗ trợ', ['Đặt ghế vững sát tường và khởi động tay, cổ chân.', 'Luân phiên đứng lên ngồi xuống và chống đẩy vào tường trong tầm thoải mái. Nghỉ khi cần.', 'Kết thúc bằng đi chậm hoặc ngồi nghỉ.']],
    es: ['Fuerza con apoyo de una silla', ['Apoya una silla estable contra la pared y calienta brazos y tobillos.', 'Alterna sentarte y levantarte con flexiones contra la pared. Descansa cuando lo necesites.', 'Termina caminando despacio o descansando sentado.']],
    fr: ['Renforcement avec une chaise', ['Placez une chaise stable contre un mur et échauffez bras et chevilles.', 'Alternez assis-debout et pompes au mur, sans forcer. Reposez-vous au besoin.', 'Terminez par une marche facile ou une pause assise.']]
  }
});

export function displayMeal(recipe, language) {
  const copy = meals[recipe.id]?.[language];
  if (!copy) return recipe;
  const [name, description, ingredients, steps] = copy;
  return { ...recipe, name, description, steps,
    ingredients: recipe.ingredients.map((item, index) => ({ ...item, name: ingredients[index] ?? item.name })) };
}

export function displayActivity(workout, language) {
  const copy = activities[workout.id]?.[language];
  return copy ? { ...workout, name: copy[0], steps: copy[1] } : workout;
}
