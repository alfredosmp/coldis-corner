import type { GlossaryTerm } from '../types/models';

type SeedGlossaryItem = Omit<GlossaryTerm, 'isFavorite' | 'isBuiltIn' | 'createdAt' | 'updatedAt'>;

const SEED_ITEMS: SeedGlossaryItem[] = [
  // === CONSTITUCIONAL Y AMPARO ===
  {
    id: 'builtin_amparo',
    term: 'Juicio de Amparo',
    branch: 'Constitucional y Amparo',
    definition:
      'Medio de control constitucional y defensa de derechos humanos en México que protege a las personas frente a normas generales, actos u omisiones de autoridad (y en ciertos casos de particulares equivalentes a autoridad) que violen derechos reconocidos en la Constitución o en tratados internacionales.',
    example:
      'Promover un juicio de amparo indirecto contra una orden de aprehensión emitida sin fundamentación ni motivación.',
    legalBasis: 'Arts. 103 y 107 CPEUM; Ley de Amparo.',
  },
  {
    id: 'builtin_amparo_directo',
    term: 'Amparo Directo',
    branch: 'Constitucional y Amparo',
    definition:
      'Modalidad del juicio de amparo que procede contra sentencias definitivas, laudos o resoluciones que pongan fin al juicio dictados por tribunales judiciales, administrativos, agrarios o del trabajo, una vez agotados los recursos ordinarios. Lo resuelven los Tribunales Colegiados de Circuito.',
    example:
      'Impugnar la sentencia definitiva dictada en apelación por una Sala Civil que condenó al pago sin valorar pruebas esenciales.',
    legalBasis: 'Art. 170 Ley de Amparo.',
  },
  {
    id: 'builtin_amparo_indirecto',
    term: 'Amparo Indirecto',
    branch: 'Constitucional y Amparo',
    definition:
      'Modalidad del juicio de amparo que se tramita ante Juzgados de Distrito (o Tribunales Colegiados de Apelación) contra normas generales, actos u omisiones fuera de juicio, después de concluido, o actos dentro de juicio de imposible reparación.',
    example:
      'Presentar amparo indirecto contra una clausura administrativa ejecutada sin audiencia previa.',
    legalBasis: 'Art. 107 Ley de Amparo.',
  },
  {
    id: 'builtin_suspension_acto',
    term: 'Suspensión del Acto Reclamado',
    branch: 'Constitucional y Amparo',
    definition:
      'Medida cautelar dentro del juicio de amparo que paraliza temporalmente la ejecución del acto de autoridad impugnado para preservar la materia del juicio y evitar daños de difícil o imposible reparación al quejoso mientras se resuelve el fondo.',
    example:
      'Solicitar la suspensión provisional y definitiva para impedir el desalojo o el congelamiento de cuentas bancarias mientras se tramita el amparo.',
    legalBasis: 'Arts. 125 a 158 Ley de Amparo.',
  },
  {
    id: 'builtin_interes_juridico',
    term: 'Interés Jurídico',
    branch: 'Constitucional y Amparo',
    definition:
      'Titularidad de un derecho subjetivo concreto reconocido por la ley que resulta afectado de manera directa y personal por un acto de autoridad, lo que legitima a la persona para acudir al juicio de amparo.',
    example:
      'El propietario con escritura pública de un inmueble afectado por un decreto de expropiación tiene interés jurídico.',
    legalBasis: 'Art. 5, fracción I, Ley de Amparo.',
  },
  {
    id: 'builtin_interes_legitimo',
    term: 'Interés Legítimo',
    branch: 'Constitucional y Amparo',
    definition:
      'Situación jurídica especial de una persona (individual o colectiva) frente al orden jurídico que, sin ser titular de un derecho subjetivo exclusivo, sufre una afectación real y diferenciada por un acto u omisión de autoridad, permitiéndole acudir al amparo.',
    example:
      'Vecinos de una colonia que promueven amparo contra la tala ilegal de un parque público por afectar su derecho al medio ambiente sano.',
    legalBasis: 'Art. 107, frac. I CPEUM; Art. 5, frac. I Ley de Amparo.',
  },
  {
    id: 'builtin_jurisprudencia',
    term: 'Jurisprudencia',
    branch: 'Constitucional y Amparo',
    definition:
      'Interpretación obligatoria de la ley y la Constitución emitida por la Suprema Corte de Justicia de la Nación, los Plenos Regionales y los Tribunales Colegiados de Circuito mediante precedentes obligatorios, reiteración o contradicción de criterios.',
    example:
      'Invocar una tesis de jurisprudencia de la SCJN en un escrito de demanda para respaldar la interpretación de un derecho.',
    legalBasis: 'Art. 94 CPEUM; Arts. 215 a 230 Ley de Amparo.',
  },
  {
    id: 'builtin_principio_pro_persona',
    term: 'Principio Pro Persona',
    branch: 'Constitucional y Amparo',
    definition:
      'Criterio hermenéutico de derechos humanos que obliga a todas las autoridades a aplicar la norma o interpretación que brinde la protección más amplia a la persona, o la restricción menos gravosa cuando se trate de limitar derechos.',
    example:
      'Elegir el plazo más favorable para el ciudadano cuando dos normas admiten interpretaciones distintas sobre un recurso.',
    legalBasis: 'Art. 1, párrafo segundo, CPEUM.',
  },
  {
    id: 'builtin_control_convencionalidad',
    term: 'Control de Convencionalidad',
    branch: 'Constitucional y Amparo',
    definition:
      'Deber de los jueces y autoridades mexicanas de verificar que las normas internas y actos de autoridad sean compatibles con la Constitución y con los tratados internacionales de derechos humanos ratificados por México, inaplicando normas contrarias.',
    example:
      'Un juez local inaplica un artículo procesal que contraviene la Convención Americana sobre Derechos Humanos.',
    legalBasis: 'Art. 1 y 133 CPEUM; Caso Radilla Pacheco.',
  },
  {
    id: 'builtin_fundamentacion_motivacion',
    term: 'Fundamentación y Motivación',
    branch: 'Constitucional y Amparo',
    definition:
      'Garantía de legalidad que exige a toda autoridad citar con precisión los preceptos legales aplicables (fundamentación) y explicar las razones, hechos y circunstancias que justifican el acto emitido (motivación).',
    example:
      'Una multa de tránsito que no señala el artículo infringido ni explica qué conducta cometió el conductor carece de fundamentación y motivación.',
    legalBasis: 'Art. 16, primer párrafo, CPEUM.',
  },
  {
    id: 'builtin_garantia_audiencia',
    term: 'Garantía de Audiencia',
    branch: 'Constitucional y Amparo',
    definition:
      'Derecho humano que impide a la autoridad privar a una persona de su libertad, propiedades, posesiones o derechos sin que antes exista un juicio seguido ante tribunales establecidos cumpliendo las formalidades esenciales del procedimiento.',
    example:
      'Antes de cancelar una licencia o concesión, la autoridad debe notificar al titular y darle oportunidad de ofrecer pruebas y alegar.',
    legalBasis: 'Art. 14, segundo párrafo, CPEUM.',
  },
  {
    id: 'builtin_supremacia_constitucional',
    term: 'Supremacía Constitucional',
    branch: 'Constitucional y Amparo',
    definition:
      'Principio conforme al cual la Constitución Política de los Estados Unidos Mexicanos es la norma fundamental y superior del ordenamiento jurídico mexicano; ninguna ley, reglamento o acto de autoridad puede contradecirla.',
    legalBasis: 'Art. 133 CPEUM.',
  },
  {
    id: 'builtin_controversia_constitucional',
    term: 'Controversia Constitucional',
    branch: 'Constitucional y Amparo',
    definition:
      'Juicio tramitado ante la SCJN para resolver conflictos de invasión de competencias o atribuciones entre poderes u órdenes de gobierno (Federación, entidades federativas, municipios u órganos constitucionales autónomos).',
    legalBasis: 'Art. 105, fracción I, CPEUM.',
  },
  {
    id: 'builtin_accion_inconstitucionalidad',
    term: 'Acción de Inconstitucionalidad',
    branch: 'Constitucional y Amparo',
    definition:
      'Medio de control abstracto ante la SCJN para plantear la posible contradicción entre una norma de carácter general (o tratado internacional) y la Constitución, promovido por entes legitimados dentro de los 30 días siguientes a su publicación.',
    legalBasis: 'Art. 105, fracción II, CPEUM.',
  },
  {
    id: 'builtin_principio_definitividad',
    term: 'Principio de Definitividad',
    branch: 'Constitucional y Amparo',
    definition:
      'Regla del juicio de amparo que obliga al quejoso a agotar previamente los recursos o medios ordinarios de defensa previstos en la ley ordinaria antes de acudir al amparo, salvo las excepciones legales (como actos que importen peligro de privación de la vida o leyes autoaplicativas).',
    legalBasis: 'Art. 107, frac. III y IV CPEUM; Art. 61 Ley de Amparo.',
  },

  // === CIVIL Y FAMILIAR ===
  {
    id: 'builtin_personalidad_juridica',
    term: 'Personalidad Jurídica',
    branch: 'Civil y Familiar',
    definition:
      'Aptitud reconocida por el Derecho para ser sujeto de derechos y obligaciones. En las personas físicas se adquiere con el nacimiento y se extingue con la muerte, protegiéndose al concebido desde el momento de la concepción.',
    legalBasis: 'Art. 22 Código Civil Federal (CCF).',
  },
  {
    id: 'builtin_capacidad_goce_ejercicio',
    term: 'Capacidad de Goce y de Ejercicio',
    branch: 'Civil y Familiar',
    definition:
      'La capacidad de goce es la aptitud para ser titular de derechos y obligaciones (la tienen todas las personas). La capacidad de ejercicio es la aptitud para ejercer esos derechos y contraer obligaciones por sí mismo (por regla general al cumplir 18 años).',
    example:
      'Un menor de 10 años puede heredar una casa (capacidad de goce), pero necesita a sus padres o tutor para venderla (capacidad de ejercicio).',
    legalBasis: 'Arts. 22, 24 y 646 CCF.',
  },
  {
    id: 'builtin_acto_juridico',
    term: 'Acto Jurídico',
    branch: 'Civil y Familiar',
    definition:
      'Manifestación de la voluntad humana realizada con la intención deliberada de crear, transmitir, modificar o extinguir derechos y obligaciones reconocidos por la ley.',
    example: 'Celebrar un contrato de compraventa, contraer matrimonio o redactar un testamento.',
    legalBasis: 'Arts. 1792 a 1796 CCF.',
  },
  {
    id: 'builtin_hecho_juridico',
    term: 'Hecho Jurídico',
    branch: 'Civil y Familiar',
    definition:
      'Acontecimiento natural o conducta humana que produce consecuencias de Derecho independientemente de que exista la intención de generarlas.',
    example: 'El nacimiento, la muerte, un terremoto que destruye un bien arrendado o un accidente vial culposo.',
  },
  {
    id: 'builtin_usucapion',
    term: 'Usucapión (Prescripción Positiva)',
    branch: 'Civil y Familiar',
    definition:
      'Modo de adquirir la propiedad de un bien mediante su posesión continua, pacífica, pública y en concepto de propietario durante el plazo que señala la ley (usualmente 5 años de buena fe o 10 años de mala fe en inmuebles).',
    example:
      'Quien posee una casa de manera pacífica, pública y continua durante 10 años como dueño puede demandar la prescripción positiva para escriturarla.',
    legalBasis: 'Arts. 1135, 1151 y 1152 CCF.',
  },
  {
    id: 'builtin_prescripcion_negativa',
    term: 'Prescripción Negativa (Liberatoria)',
    branch: 'Civil y Familiar',
    definition:
      'Extinción de una obligación o liberación de una deuda por el mero transcurso del tiempo establecido en la ley sin que el acreedor haya exigido su cumplimiento.',
    example: 'El cobro de honorarios o rentas vencidas prescribe si el acreedor deja pasar el plazo legal sin reclamar.',
    legalBasis: 'Arts. 1135 y 1158 a 1164 CCF.',
  },
  {
    id: 'builtin_caducidad',
    term: 'Caducidad',
    branch: 'Civil y Familiar',
    definition:
      'Extinción automática de un derecho, facultad o instancia procesal por no haberse ejercitado dentro del plazo fatal señalado por la ley o convenido por las partes. A diferencia de la prescripción, generalmente no se interrumpe ni se suspende.',
    example: 'La caducidad de la instancia ocurre cuando ninguna parte impulsa un juicio civil durante el periodo legal.',
  },
  {
    id: 'builtin_nulidad_absoluta_relativa',
    term: 'Nulidad Absoluta y Relativa',
    branch: 'Civil y Familiar',
    definition:
      'La nulidad absoluta sanciona actos contrarios a leyes prohibitivas o de interés público (no prescribe, no se convalida y cualquiera con interés puede invocarla). La nulidad relativa protege intereses particulares, como vicios del consentimiento o incapacidad, y sí puede convalidarse o prescribir.',
    legalBasis: 'Arts. 2224 a 2231 CCF.',
  },
  {
    id: 'builtin_usufructo',
    term: 'Usufructo',
    branch: 'Civil y Familiar',
    definition:
      'Derecho real y temporal que faculta a una persona (usufructuario) a usar y disfrutar de los frutos de un bien ajeno sin alterar su sustancia, mientras otra conserva la nuda propiedad.',
    example: 'Una madre dona la nuda propiedad de su casa a sus hijos, pero se reserva el usufructo vitalicio para vivir ahí o rentarla.',
    legalBasis: 'Arts. 980 a 988 CCF.',
  },
  {
    id: 'builtin_dano_moral',
    term: 'Daño Moral',
    branch: 'Civil y Familiar',
    definition:
      'Afectación que sufre una persona en sus sentimientos, afectos, creencias, decoro, honor, reputación, vida privada o consideración que de sí misma tienen los demás, generando el derecho a una indemnización económica.',
    legalBasis: 'Art. 1916 CCF.',
  },
  {
    id: 'builtin_alimentos',
    term: 'Alimentos (Derecho Familiar)',
    branch: 'Civil y Familiar',
    definition:
      'Obligación recíproca y de orden público que comprende comida, vestido, habitación, atención médica y, respecto de menores, los gastos necesarios para su educación y sano esparcimiento, proporcionales a la posibilidad de quien los da y la necesidad de quien los recibe.',
    legalBasis: 'Arts. 301 a 311 CCF.',
  },
  {
    id: 'builtin_patria_potestad',
    term: 'Patria Potestad',
    branch: 'Civil y Familiar',
    definition:
      'Conjunto de derechos y deberes que la ley confiere a los progenitores (y en su defecto a los abuelos) sobre la persona y bienes de sus hijos menores de edad no emancipados, siempre guiada por el interés superior de la niñez.',
    legalBasis: 'Arts. 411 a 448 CCF.',
  },
  {
    id: 'builtin_sucesion',
    term: 'Sucesión Testamentaria e Intestamentaria',
    branch: 'Civil y Familiar',
    definition:
      'Transmisión de todos los bienes, derechos y obligaciones transmisibles de una persona que fallece. Es testamentaria cuando existe un testamento válido, e intestamentaria (legítima) cuando no lo hay y la ley determina el orden de herederos.',
    legalBasis: 'Arts. 1281 a 1283 CCF.',
  },
  {
    id: 'builtin_vicios_consentimiento',
    term: 'Vicios del Consentimiento',
    branch: 'Civil y Familiar',
    definition:
      'Circunstancias que alteran la voluntad libre y consciente al celebrar un acto jurídico —error, dolo, mala fe, violencia o lesión— y que dan lugar a su nulidad relativa.',
    legalBasis: 'Arts. 1812 a 1823 CCF.',
  },

  // === PENAL Y CNPP ===
  {
    id: 'builtin_tipo_penal',
    term: 'Tipo Penal',
    branch: 'Penal y CNPP',
    definition:
      'Descripción abstracta que hace el legislador en la ley penal de una conducta considerada delictiva y de la sanción que le corresponde. Sin tipo penal previo no existe delito (principio de legalidad).',
    legalBasis: 'Art. 14, tercer párrafo, CPEUM.',
  },
  {
    id: 'builtin_teoria_delito',
    term: 'Elementos del Delito (Tipicidad, Antijuridicidad y Culpabilidad)',
    branch: 'Penal y CNPP',
    definition:
      'Categorías analíticas para determinar si una conducta es delito: la tipicidad verifica que encaje en el tipo penal; la antijuridicidad que sea contraria a Derecho sin causa de justificación (como legítima defensa); y la culpabilidad que sea reprochable al autor.',
  },
  {
    id: 'builtin_dolo',
    term: 'Dolo (Directo y Eventual)',
    branch: 'Penal y CNPP',
    definition:
      'Obra dolosamente quien, conociendo los elementos del tipo penal o previendo como posible el resultado típico, quiere (dolo directo) o acepta (dolo eventual) la realización del hecho descrito por la ley.',
    example:
      'En dolo eventual, quien dispara hacia una multitud sin querer matar a alguien específico pero aceptando la alta probabilidad de hacerlo.',
    legalBasis: 'Art. 9 Código Penal Federal.',
  },
  {
    id: 'builtin_culpa',
    term: 'Culpa (Imprudencia)',
    branch: 'Penal y CNPP',
    definition:
      'Obra culposamente quien produce el resultado típico sin quererlo, por infracción a un deber objetivo de cuidado que debía y podía observar según las circunstancias (negligencia, impericia o imprudencia).',
    example: 'Causar lesiones en un choque por conducir revisando el celular.',
    legalBasis: 'Art. 9 Código Penal Federal.',
  },
  {
    id: 'builtin_ministerio_publico',
    term: 'Ministerio Público',
    branch: 'Penal y CNPP',
    definition:
      'Institución pública autónoma encargada de conducir la investigación de los delitos, coordinar a las policías y servicios periciales, ejercer la acción penal ante los tribunales y proteger a las víctimas.',
    legalBasis: 'Art. 21 CPEUM; Arts. 127 a 131 CNPP.',
  },
  {
    id: 'builtin_vinculacion_proceso',
    term: 'Auto de Vinculación a Proceso',
    branch: 'Penal y CNPP',
    definition:
      'Resolución emitida por el Juez de Control en la audiencia inicial cuando existen datos de prueba que establecen que se ha cometido un hecho que la ley señala como delito y la probabilidad de que el imputado lo cometió o participó en su comisión.',
    legalBasis: 'Art. 19 CPEUM; Arts. 316 y 317 CNPP.',
  },
  {
    id: 'builtin_presuncion_inocencia',
    term: 'Presunción de Inocencia',
    branch: 'Penal y CNPP',
    definition:
      'Derecho humano y principio rector del proceso penal conforme al cual toda persona debe ser tratada como inocente en todas las etapas del procedimiento mientras no se declare su responsabilidad mediante sentencia firme emitida por un juez.',
    legalBasis: 'Art. 20, Apartado B, frac. I CPEUM; Art. 13 CNPP.',
  },
  {
    id: 'builtin_prision_preventiva',
    term: 'Prisión Preventiva (Justificada y Oficiosa)',
    branch: 'Penal y CNPP',
    definition:
      'Medida cautelar más severa en el proceso penal consistente en la privación temporal de la libertad del imputado cuando otras medidas no bastan para garantizar su comparecencia, proteger a la víctima o evitar la obstaculización de la investigación.',
    legalBasis: 'Art. 19 CPEUM; Arts. 155 y 167 CNPP.',
  },
  {
    id: 'builtin_procedimiento_abreviado',
    term: 'Procedimiento Abreviado',
    branch: 'Penal y CNPP',
    definition:
      'Forma de terminación anticipada del proceso penal en la que el imputado reconoce voluntariamente su participación en el delito y acepta ser juzgado con los medios de convicción de la carpeta de investigación, a cambio de una reducción de la pena.',
    legalBasis: 'Arts. 201 a 207 CNPP.',
  },
  {
    id: 'builtin_cadena_custodia',
    term: 'Cadena de Custodia',
    branch: 'Penal y CNPP',
    definition:
      'Sistema de control y registro continuo que se aplica a los indicios, evidencias o instrumentos del delito desde su localización en el lugar de los hechos hasta que la autoridad competente ordena su conclusión, para garantizar su autenticidad e integridad.',
    legalBasis: 'Arts. 227 y 228 CNPP.',
  },
  {
    id: 'builtin_flagrancia',
    term: 'Flagrancia',
    branch: 'Penal y CNPP',
    definition:
      'Situación en la que una persona es detenida en el momento mismo de estar cometiendo un delito, o inmediatamente después mediante persecución material ininterrumpida o señalamiento con objetos o indicios que hagan presumir fundadamente su intervención.',
    legalBasis: 'Art. 16 CPEUM; Art. 146 CNPP.',
  },

  // === PROCESAL Y TEORÍA DEL PROCESO ===
  {
    id: 'builtin_jurisdiccion',
    term: 'Jurisdicción',
    branch: 'Procesal y Teoría del Proceso',
    definition:
      'Función soberana del Estado ejercida por los tribunales para conocer, tramitar y resolver controversias jurídicas con fuerza vinculatoria ("decir el Derecho").',
  },
  {
    id: 'builtin_competencia',
    term: 'Competencia',
    branch: 'Procesal y Teoría del Proceso',
    definition:
      'Límite o medida específica de la jurisdicción que corresponde a cada juez o tribunal según criterios de materia (civil, penal, mercantil), cuantía, grado (instancia) y territorio.',
    example: 'Todos los jueces tienen jurisdicción, pero solo un juez familiar de la ciudad tiene competencia para resolver un divorcio ahí.',
  },
  {
    id: 'builtin_cosa_juzgada',
    term: 'Cosa Juzgada',
    branch: 'Procesal y Teoría del Proceso',
    definition:
      'Calidad de firmeza, inmutabilidad y definitividad que adquiere una sentencia contra la cual ya no procede ningún recurso ordinario ni extraordinario, impidiendo que el mismo asunto vuelva a litigarse entre las mismas partes.',
    example: 'Si un juicio civil ya tiene sentencia ejecutoriada, no puede demandarse de nuevo la misma prestación por la misma causa.',
  },
  {
    id: 'builtin_litispendencia',
    term: 'Litispendencia',
    branch: 'Procesal y Teoría del Proceso',
    definition:
      'Excepción procesal que procede cuando ya existe otro juicio pendiente de resolución entre las mismas partes, sobre el mismo objeto y por la misma causa, evitando sentencias contradictorias.',
  },
  {
    id: 'builtin_emplazamiento',
    term: 'Emplazamiento',
    branch: 'Procesal y Teoría del Proceso',
    definition:
      'Acto procesal formal y solemne mediante el cual el actuario notifica personalmente al demandado que existe una demanda en su contra, entregándole copia de la misma y fijándole un plazo para contestar. Su falta o defecto grave anula el procedimiento.',
  },
  {
    id: 'builtin_preclusion',
    term: 'Preclusión',
    branch: 'Procesal y Teoría del Proceso',
    definition:
      'Pérdida o extinción de la facultad procesal de las partes para realizar un acto (como contestar, ofrecer pruebas o apelar) por no haberlo ejercido dentro del plazo legal o en la etapa procesal oportuna.',
  },
  {
    id: 'builtin_carga_prueba',
    term: 'Carga de la Prueba',
    branch: 'Procesal y Teoría del Proceso',
    definition:
      'Regla procesal que indica a cuál de las partes le corresponde acreditar los hechos en los que funda sus pretensiones o defensas. Por regla general, quien afirma está obligado a probar.',
    legalBasis: 'Art. 81 Código Federal de Procedimientos Civiles / CNPCF.',
  },
  {
    id: 'builtin_sentencia_interlocutoria',
    term: 'Sentencia Interlocutoria y Definitiva',
    branch: 'Procesal y Teoría del Proceso',
    definition:
      'La sentencia interlocutoria resuelve un incidente o cuestión accesoria dentro del juicio sin decidir el fondo principal. La sentencia definitiva resuelve el conflicto principal del litigio absolviendo o condenando.',
  },
  {
    id: 'builtin_exhorto',
    term: 'Exhorto',
    branch: 'Procesal y Teoría del Proceso',
    definition:
      'Comunicación oficial mediante la cual un juez solicita el auxilio de otro juez de igual jerarquía ubicado en distinta jurisdicción territorial para practicar una diligencia (como un emplazamiento o desahogo de prueba).',
  },

  // === MERCANTIL, LABORAL Y ADMINISTRATIVO ===
  {
    id: 'builtin_titulos_credito',
    term: 'Títulos de Crédito',
    branch: 'Mercantil',
    definition:
      'Documentos necesarios para ejercitar el derecho literal que en ellos se consigna (como el pagaré, la letra de cambio y el cheque). Se caracterizan por incorporación, legitimación, literalidad y autonomía.',
    legalBasis: 'Art. 5 Ley General de Títulos y Operaciones de Crédito (LGTOC).',
  },
  {
    id: 'builtin_endoso',
    term: 'Endoso',
    branch: 'Mercantil',
    definition:
      'Cláusula escrita en el propio título de crédito o en hoja adherida mediante la cual el tenedor transmite la propiedad del título, lo entrega en procuración (para cobro) o en garantía.',
    legalBasis: 'Arts. 26 a 36 LGTOC.',
  },
  {
    id: 'builtin_despido_injustificado',
    term: 'Despido Injustificado',
    branch: 'Laboral',
    definition:
      'Terminación unilateral de la relación laboral decidida por el patrón sin que exista alguna de las causas legales de rescisión sin responsabilidad previstas en el artículo 47 de la LFT, dando derecho al trabajador a elegir entre reinstalación o indemnización constitucional de 3 meses de salario.',
    legalBasis: 'Art. 123, Apartado A, frac. XXII CPEUM; Arts. 47 y 48 LFT.',
  },
  {
    id: 'builtin_prima_antiguedad',
    term: 'Prima de Antigüedad',
    branch: 'Laboral',
    definition:
      'Prestación laboral consistente en el importe de 12 días de salario por cada año de servicios prestados (con tope del doble del salario mínimo), pagadera al separarse voluntariamente con 15 años o más, o en cualquier despido (justificado o injustificado).',
    legalBasis: 'Art. 162 Ley Federal del Trabajo (LFT).',
  },
  {
    id: 'builtin_acto_administrativo',
    term: 'Acto Administrativo',
    branch: 'Administrativo',
    definition:
      'Declaración unilateral de voluntad emitida por un órgano de la Administración Pública en ejercicio de su potestad administrativa que crea, reconoce, modifica o extingue situaciones jurídicas individuales y concretas.',
    example: 'Otorgar una licencia de funcionamiento, emitir una resolución fiscal o imponer una multa administrativa.',
    legalBasis: 'Art. 3 Ley Federal de Procedimiento Administrativo.',
  },
  {
    id: 'builtin_silencio_administrativo',
    term: 'Silencio Administrativo (Negativa y Afirmativa Ficta)',
    branch: 'Administrativo',
    definition:
      'Consecuencia jurídica que la ley atribuye a la falta de respuesta oportuna de la autoridad ante una petición del particular. En la negativa ficta se presume rechazada para poder impugnarla; en la afirmativa ficta (cuando la ley expresamente la prevé) se tiene por aprobada.',
    legalBasis: 'Art. 17 Ley Federal de Procedimiento Administrativo; Art. 37 CFF.',
  },

  // === LOCUCIONES LATINAS ===
  {
    id: 'builtin_erga_omnes',
    term: 'Erga omnes',
    branch: 'Locuciones Latinas',
    definition:
      '"Frente a todos" o "respecto de todos". Indica que una norma, un derecho real (como la propiedad) o una declaratoria general de inconstitucionalidad produce efectos generales y es oponible a cualquier persona, no solo entre las partes de un contrato o juicio.',
    isLatin: true,
  },
  {
    id: 'builtin_in_dubio_pro_reo',
    term: 'In dubio pro reo',
    branch: 'Locuciones Latinas',
    definition:
      '"En caso de duda, a favor del acusado". Principio penal derivado de la presunción de inocencia: si tras valorar las pruebas subsiste duda razonable sobre la culpabilidad del imputado, el juez debe absolver.',
    isLatin: true,
  },
  {
    id: 'builtin_pacta_sunt_servanda',
    term: 'Pacta sunt servanda',
    branch: 'Locuciones Latinas',
    definition:
      '"Los pactos deben cumplirse". Principio fundamental del Derecho Civil e Internacional que establece la obligatoriedad de los contratos válidamente celebrados entre las partes como si fueran ley para ellas.',
    legalBasis: 'Art. 1796 CCF.',
    isLatin: true,
  },
  {
    id: 'builtin_rebus_sic_stantibus',
    term: 'Rebus sic stantibus',
    branch: 'Locuciones Latinas',
    definition:
      '"Estando así las cosas". Cláusula o teoría de la imprevisión que permite revisar o equilibrar un contrato cuando sobrevienen circunstancias extraordinarias e imprevisibles que hacen excesivamente onerosa la obligación para una de las partes.',
    isLatin: true,
  },
  {
    id: 'builtin_non_bis_in_idem',
    term: 'Non bis in idem',
    branch: 'Locuciones Latinas',
    definition:
      '"No dos veces por lo mismo". Garantía constitucional que prohíbe juzgar o sancionar dos veces a una misma persona por los mismos hechos delictivos, ya sea que en el primer juicio haya sido absuelta o condenada.',
    legalBasis: 'Art. 23 CPEUM.',
    isLatin: true,
  },
  {
    id: 'builtin_iura_novit_curia',
    term: 'Iura novit curia',
    branch: 'Locuciones Latinas',
    definition:
      '"El tribunal conoce el Derecho". Principio procesal según el cual las partes aportan y prueban los hechos, mientras que el juez conoce las normas jurídicas y debe aplicar el Derecho correcto aunque las partes hayan citado mal un artículo.',
    isLatin: true,
  },
  {
    id: 'builtin_habeas_corpus',
    term: 'Habeas corpus',
    branch: 'Locuciones Latinas',
    definition:
      '"Que tengas tu cuerpo". Institución jurídica histórica que protege la libertad personal contra detenciones arbitrarias o incomunicación. En México se tutela primordialmente a través del Juicio de Amparo (Art. 15 Ley de Amparo).',
    isLatin: true,
  },
  {
    id: 'builtin_onus_probandi',
    term: 'Onus probandi',
    branch: 'Locuciones Latinas',
    definition:
      '"Carga de la prueba". Expresión latina que designa sobre qué parte recae el deber procesal de demostrar la veracidad de un hecho controvertido en juicio.',
    isLatin: true,
  },
  {
    id: 'builtin_a_quo_ad_quem',
    term: 'A quo / Ad quem',
    branch: 'Locuciones Latinas',
    definition:
      '"Juez a quo" es el juez o tribunal inferior cuya resolución se impugna; "Juez o Tribunal ad quem" es el órgano superior ante el cual se interpone el recurso (como la Sala de apelación). También se usa para designar el día inicial (dies a quo) y final (dies ad quem) de un plazo.',
    isLatin: true,
  },
  {
    id: 'builtin_ex_officio',
    term: 'Ex officio',
    branch: 'Locuciones Latinas',
    definition:
      '"De oficio" o por virtud del cargo. Indica que una autoridad o juez debe actuar por iniciativa propia conforme a la ley, sin necesidad de que alguna de las partes lo solicite expresamente.',
    isLatin: true,
  },
  {
    id: 'builtin_bona_fide',
    term: 'Bona fide',
    branch: 'Locuciones Latinas',
    definition:
      '"De buena fe". Principio general del Derecho que exige honestidad, lealtad y convicción de actuar conforme a Derecho en los contratos, posesión de bienes y actuaciones procesales.',
    isLatin: true,
  },
  {
    id: 'builtin_mutatis_mutandis',
    term: 'Mutatis mutandis',
    branch: 'Locuciones Latinas',
    definition:
      '"Cambiando lo que se deba cambiar". Se usa al aplicar una regla, precedente o cláusula de un caso a otro haciendo las adaptaciones necesarias en los detalles particulares.',
    isLatin: true,
  },
];

export function buildSeedGlossary(): GlossaryTerm[] {
  const now = Date.now();
  return SEED_ITEMS.map((item, idx) => ({
    ...item,
    isFavorite: false,
    isBuiltIn: true,
    createdAt: now - (SEED_ITEMS.length - idx) * 1000,
    updatedAt: now - (SEED_ITEMS.length - idx) * 1000,
  }));
}
