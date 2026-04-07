import { useState, useEffect, useRef } from "react";

function App() {
  const [pokemonList, setPokemonList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPokemon, setSelectedPokemon] = useState(null);
  const [evolutions, setEvolutions] = useState([]);
  const [mainDetailImage, setMainDetailImage] = useState("");
  const [mainDetailName, setMainDetailName] = useState("");

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
    setMainDetailImage(pokemon.sprites.other["official-artwork"].front_default);
    setMainDetailName(pokemon.name);
    setEvolutions([]);

    try {
      const specRes = await fetch(
        `https://pokeapi.co/api/v2/pokemon-species/${pokemon.id}/`,
      );
      const specData = await specRes.json();
      const evoRes = await fetch(specData.evolution_chain.url);
      const evoData = await evoRes.json();

      const allEvolutions = [];

      // Función mágica que recorre ramas paralelas
      const traverse = (node) => {
        const id = node.species.url.split("/")[6];
        allEvolutions.push({
          name: node.species.name,
          image: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`,
        });

        // Si hay evoluciones (pueden ser 1, 2 o 8 como Eevee)
        if (node.evolves_to.length > 0) {
          node.evolves_to.forEach((evolutionNode) => {
            traverse(evolutionNode);
          });
        }
      };

      traverse(evoData.chain);
      setEvolutions(allEvolutions);
    } catch (e) {
      console.error("Error en evoluciones complejas", e);
    }
  };

  const changeMainView = (evo) => {
    setMainDetailImage(evo.image);
    setMainDetailName(evo.name);
    // Opcional: mover el scroll hacia arriba para ver el cambio
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (selectedPokemon) {
    return (
      <div className="detail-view">
        <button className="back-btn" onClick={() => setSelectedPokemon(null)}>
          ←
        </button>

        {/* Usamos el nuevo estado para la imagen y el nombre */}
        <img
          className="main-sprite"
          src={mainDetailImage}
          alt={mainDetailName}
        />
        <h1 style={{ textAlign: "center", textTransform: "capitalize" }}>
          {mainDetailName}
        </h1>

        <div className="evolution-chain">
          {evolutions.map((evo, i) => (
            <div
              key={i}
              className="evo-item"
              onClick={() => changeMainView(evo)} // Al hacer clic, cambia la de arriba
              style={{ cursor: "pointer" }}
            >
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
