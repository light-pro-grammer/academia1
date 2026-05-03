update public.subjects
set icon = case slug
  when 'matematyka' then 'emoji:🧮'
  when 'fizyka' then 'emoji:⚛️'
  when 'khimiia' then 'emoji:🧪'
  when 'biolohiia' then 'emoji:🧬'
  when 'informatyka' then 'emoji:🖥️'
  when 'kompiuterni-nauky' then 'emoji:💻'
  when 'movy-prohramuvannia' then 'emoji:⌨️'
  when 'informatsiini-tekhnolohii' then 'emoji:⚙️'
  when 'inozemni-movy' then 'emoji:🗣️'
  when 'anhliiska-mova' then 'emoji:🗣️'
  when 'istoriia' then 'emoji:🏛️'
  when 'istoriia-ukrainy' then 'emoji:🏛️'
  when 'heohrafiia' then 'emoji:🌎'
  when 'inzheneriia' then 'emoji:🔧'
  when 'ekonomika' then 'emoji:📈'
  when 'filosofiia' then 'emoji:🤔'
  when 'antropolohiia' then 'emoji:🏺'
  else icon
end
where slug in (
  'matematyka',
  'fizyka',
  'khimiia',
  'biolohiia',
  'informatyka',
  'kompiuterni-nauky',
  'movy-prohramuvannia',
  'informatsiini-tekhnolohii',
  'inozemni-movy',
  'anhliiska-mova',
  'istoriia',
  'istoriia-ukrainy',
  'heohrafiia',
  'inzheneriia',
  'ekonomika',
  'filosofiia',
  'antropolohiia'
);
