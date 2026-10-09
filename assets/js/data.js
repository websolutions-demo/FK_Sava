window.FKSAVA_DATA = {
  phoneDisplay: '065 / 251 88 45',
  phoneTel: '+381652518845',
  youtubeSearch: 'https://www.youtube.com/results?search_query=FK+Sava+45',
  years: Array.from({length: 10}, (_, i) => 2011 + i).map((year, yearIndex) => ({
    year,
    coach: 'Trener — podatak kluba',
    image: `assets/images/age-${year}.jpg`,
    players: Array.from({length: 8}, (_, i) => ({
      id: `${year}-${i+1}`,
      name: `Igrač ${String(i+1).padStart(2,'0')}`,
      number: [1,3,5,7,8,9,10,11][i],
      position: ['Golman','Odbrana','Odbrana','Vezni','Vezni','Napadač','Vezni','Napadač'][i],
      appearances: Math.max(4, 14 - yearIndex - (i%3)),
      goals: i === 0 ? 0 : Math.max(0, 9 - (i%5) - Math.floor(yearIndex/2)),
      assists: i === 0 ? 0 : Math.max(0, 6 - (i%4)),
      note: 'Demo profil — ime, broj i statistike zameniti podacima koje klub odobri.'
    }))
  })),
  matches: [
    {
      title: 'Arhiva FK Sava 45',
      meta: 'Video zapis kluba',
      description: 'Primer YouTube pregleda u modalu. Za novu sezonu samo zameniti video ID u data.js.',
      image: 'assets/images/match1.jpg',
      videoId: 'ACb081-H7eE'
    },
    {
      title: 'FK Sava — mlađe kategorije',
      meta: 'Demo kartica utakmice',
      description: 'Kartica je spremna za konkretan YouTube link kada ga klub dostavi.',
      image: 'assets/images/match2.jpg',
      videoId: null
    },
    {
      title: 'Trening / highlights',
      meta: 'Demo video sadržaj',
      description: 'Može da vodi na trening, highlights ili celu utakmicu.',
      image: 'assets/images/match3.jpg',
      videoId: null
    },
    {
      title: 'Prijateljska utakmica',
      meta: 'Demo video sadržaj',
      description: 'Klik otvara veliki preview modal i link ka YouTube-u.',
      image: 'assets/images/match4.jpg',
      videoId: null
    }
  ],
  gallery: [
    'assets/images/gallery1.jpg','assets/images/gallery2.jpg','assets/images/gallery3.jpg',
    'assets/images/gallery4.jpg','assets/images/gallery5.jpg','assets/images/gallery6.jpg',
    'assets/images/instagram-1.jpg','assets/images/instagram-2.jpg'
  ]
};
