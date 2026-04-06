import { useState, useEffect, useRef } from "react";

function App() {
  const [pokemonList, setPokemonList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPokemon, setSelectedPokemon] = useState(null);
  const [evolutions, setEvolutions] = useState([]);

  // USAMOS REFS PARA CONTROLAR EL FLUJO
  const offsetRef = useRef(0);
  const scrollPos = useRef(0);
  const loaderRef = useRef(null);
  const isFetching = useRef(false); // Bloqueo real

  const fetchPokemon = async () => {
    if (isFetching.current) return;
    isFetching.current = true;
    setLoading(true);

    try {
      const res = await fetch(
        `https://pokeapi.co/api/v2/pokemon?limit=20&offset=${offsetRef.current}`,
      );
      const data = await res.json();

      const detailPromises = data.results.map(async (p) => {
        const r = await fetch(p.url);
        return await r.json();
      });

      const details = await Promise.all(detailPromises);

      setPokemonList((prev) => {
        // Doble validación: solo agregamos si el ID no existe
        const ids = new Set(prev.map((p) => p.id));
        const unique = details.filter((p) => !ids.has(p.id));
        return [...prev, ...unique];
      });

      // Solo si la carga fue exitosa, preparamos el siguiente offset
      offsetRef.current += 20;
    } catch (error) {
      console.error("Error", error);
    } finally {
      setLoading(false);
      isFetching.current = false;
    }
  };

  // 1. CARGA INICIAL: Solo una vez al montar
  useEffect(() => {
    fetchPokemon();
  }, []);

  // 2. OBSERVER: Solo dispara si no estamos cargando y hay scroll
  useEffect(() => {
    if (selectedPokemon) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Solo disparamos si el elemento es visible Y no hay una descarga en curso
        if (entries[0].isIntersecting && !isFetching.current) {
          fetchPokemon();
        }
      },
      { threshold: 0.1 },
    );

    if (loaderRef.current) observer.observe(loaderRef.current);

    return () => observer.disconnect();
  }, [selectedPokemon]); // Se reinicia solo al cambiar de vista

  useEffect(() => {
    // Si volvemos a la lista (selectedPokemon es null)
    // y teníamos una posición guardada
    if (!selectedPokemon && scrollPos.current > 0) {
      // Usamos un pequeño timeout para dar tiempo a que el DOM se renderice
      setTimeout(() => {
        window.scrollTo(0, scrollPos.current);
      }, 10);
    }
  }, [selectedPokemon]);

  // --- VISTA DE DETALLE (Mantenla igual que la tienes) ---
  const handleSelect = async (pokemon) => {
    scrollPos.current = window.scrollY;
    setSelectedPokemon(pokemon);
    setEvolutions([]);
    try {
      const specRes = await fetch(
        `https://pokeapi.co/api/v2/pokemon-species/${pokemon.id}/`,
      );
      const specData = await specRes.json();
      const evoRes = await fetch(specData.evolution_chain.url);
      const evoData = await evoRes.json();
      let chain = [];
      let current = evoData.chain;
      while (current) {
        const id = current.species.url.split("/")[6];
        chain.push({
          name: current.species.name,
          image: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`,
        });
        current = current.evolves_to[0];
      }
      setEvolutions(chain);
    } catch (e) {
      console.error(e);
    }
  };

  if (selectedPokemon) {
    return (
      <div className="detail-view">
        <button className="back-btn" onClick={() => setSelectedPokemon(null)}>
          ←
        </button>
        <img
          className="main-sprite"
          src={selectedPokemon.sprites.other["official-artwork"].front_default}
          alt={selectedPokemon.name}
        />
        <h1 style={{ textAlign: "center", textTransform: "capitalize" }}>
          {selectedPokemon.name}
        </h1>
        <div className="evolution-chain">
          {evolutions.map((evo, i) => (
            <div key={i} className="evo-item">
              <p>Evolución {i + 1}</p>
              <img src={evo.image} alt={evo.name} />
              <p>{evo.name}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <header className="header">
        <h1>Pokédex</h1>
      </header>
      <div className="grid">
        {pokemonList.map((pokemon, index) => (
          <div
            key={`${pokemon.id}-${index}`}
            className="card"
            onClick={() => handleSelect(pokemon)}
          >
            <span className="id-tag">
              #{pokemon.id.toString().padStart(3, "0")}
            </span>
            <img
              src={pokemon.sprites.other["official-artwork"].front_default}
              alt={pokemon.name}
            />
            <h2>{pokemon.name}</h2>
          </div>
        ))}
      </div>
      <div ref={loaderRef} className="loader">
        {loading ? "Cargando Pokémon..." : "Desliza para ver más"}
      </div>
    </div>
  );
}

export default App;
